/* ===== 戦闘エンジン（描画から独立した純ロジック） ===== */
window.G = window.G || {};

G.Battle = {

  /* ---------- 生成 ---------- */

  /* 味方キャラ → 戦闘ユニット */
  allyUnit(c) {
    const d = G.Char.derived(c);
    return {
      uid: 'a_' + c.key,
      side: 'ally', ref: c,
      name: c.name, icon: c.icon,
      hp: G.util.clamp(c.hp, 0, d.hp), maxHp: d.hp,
      mp: G.util.clamp(c.mp, 0, d.mp), maxMp: d.mp,
      base: { atk: d.atk, def: d.def, mag: d.mag, res: d.res, spd: d.spd },
      skills: c.skills.slice(),
      buffs: [], status: {}, guarding: false,
      weak: [], resist: [], tags: [],
      weaponEl: (G.ITEMS[c.equip.weapon] || {}).el || null,
    };
  },

  /* 敵ID → 戦闘ユニット（同名が複数いるときは A/B/C を付ける） */
  enemyUnit(id, index, suffix) {
    const e = G.ENEMIES[id];
    const sc = G.enemyScale(e.lv, !!e.boss);
    const shp  = Math.floor(e.hp * sc.hp);
    const satk = Math.floor(e.atk * sc.atk);
    const smag = Math.floor(e.mag * sc.mag);
    return {
      uid: 'e' + index + '_' + id,
      side: 'enemy', enemyId: id,
      name: e.name + (suffix || ''), icon: e.icon,
      hp: shp, maxHp: shp,
      mp: e.mp || 0, maxMp: e.mp || 0,
      base: { atk: satk, def: e.def, mag: smag, res: e.res, spd: e.spd },
      skills: (e.skills || []).slice(),
      buffs: [], status: {}, guarding: false,
      weak: e.weak || [], resist: e.resist || [], tags: e.tags || [],
      isBoss: !!e.boss, lv: e.lv, exp: e.exp, gold: e.gold, drops: e.drops || [],
      analyzed: false,
    };
  },

  /* 戦闘開始 */
  init(enemyIds, opts = {}) {
    const party = G.State.d.party;
    // 全員戦闘不能なら回復してから開始（詰み防止）
    if (!party.some(c => c.hp > 0)) G.State.restParty();

    const counts = {};
    for (const id of enemyIds) counts[id] = (counts[id] || 0) + 1;
    const seen = {};
    const enemies = enemyIds.map((id, i) => {
      let suffix = '';
      if (counts[id] > 1) {
        seen[id] = (seen[id] || 0) + 1;
        suffix = ' ' + 'ABCDE'[seen[id] - 1];
      }
      return G.Battle.enemyUnit(id, i, suffix);
    });

    const b = {
      allies: party.map(G.Battle.allyUnit),
      enemies,
      round: 0,
      order: [],
      cursor: 0,
      log: [],
      over: false,
      result: null,
      canFlee: opts.canFlee !== false,
      isBoss: enemies.some(e => e.isBoss),
      context: opts.context || {},
      stolen: [],
      gainedGold: 0,
    };
    for (const e of enemies) G.State.recordEnemy(e.enemyId);
    G.State.d.stats.battles++;
    return b;
  },

  /* ---------- 参照ヘルパー ---------- */
  units(b) { return b.allies.concat(b.enemies); },
  unitById(b, uid) { return G.Battle.units(b).find(u => u.uid === uid); },
  alive(list) { return list.filter(u => u.hp > 0); },
  livingAllies(b) { return G.Battle.alive(b.allies); },
  livingEnemies(b) { return G.Battle.alive(b.enemies); },
  enemySide(b, u) { return u.side === 'ally' ? b.enemies : b.allies; },
  ownSide(b, u) { return u.side === 'ally' ? b.allies : b.enemies; },

  /* バフ込みの実効ステータス */
  stat(u, key) {
    let mult = 1;
    for (const bf of u.buffs) if (bf.stat === key) mult += bf.val;
    return Math.max(1, Math.floor(u.base[key] * Math.max(0.2, mult)));
  },

  /* バフの合計値（crit / eva / taunt などステータス以外） */
  modSum(u, key) {
    let v = 0;
    for (const bf of u.buffs) if (bf.stat === key) v += bf.val;
    return v;
  },

  hasStatus(u, s) { return !!u.status[s]; },

  /* ---------- ターン順 ---------- */
  startRound(b) {
    b.round++;
    const list = G.Battle.alive(G.Battle.units(b));
    b.order = list
      .map(u => ({ u, spd: G.Battle.stat(u, 'spd') * G.util.rand(0.92, 1.08) }))
      .sort((x, y) => y.spd - x.spd)
      .map(x => x.u.uid);
    b.cursor = 0;
    for (const u of list) u.guarding = false;
  },

  /* 次に行動するユニット。ラウンド終端なら null */
  nextActor(b) {
    while (b.cursor < b.order.length) {
      const u = G.Battle.unitById(b, b.order[b.cursor]);
      if (u && u.hp > 0) return u;
      b.cursor++;
    }
    return null;
  },

  advanceCursor(b) { b.cursor++; },

  /* ---------- ターン開始処理（毒・睡眠など）----------
   * 戻り値 {events:[], canAct:bool} */
  beginTurn(b, u) {
    const events = [];
    let canAct = true;

    for (const [st, info] of Object.entries(u.status)) {
      const def = G.STATUS[st];
      if (!def) { delete u.status[st]; continue; }

      if (def.dotRate) {
        const dmg = Math.max(1, Math.floor(u.maxHp * def.dotRate));
        u.hp = Math.max(0, u.hp - dmg);
        events.push({ type: 'dot', target: u, amount: dmg, status: st,
          text: `${u.name}は${def.name}で${dmg}のダメージ！` });
        if (u.hp <= 0) events.push({ type: 'down', target: u, text: `${u.name}は倒れた。` });
      }
      if (u.hp <= 0) { canAct = false; break; }
      if (def.skip) {
        canAct = false;
        events.push({ type: 'skip', target: u, text: `${u.name}は${def.name}で動けない。` });
      } else if (def.skipRate && G.util.chance(def.skipRate)) {
        canAct = false;
        events.push({ type: 'skip', target: u, text: `${u.name}は${def.name}して動けない！` });
      }
    }
    return { events, canAct };
  },

  /* ターン終了：バフと状態異常の経過 */
  endTurn(b, u) {
    const events = [];
    u.buffs = u.buffs.filter(bf => { bf.turns--; return bf.turns > 0; });
    for (const [st, info] of Object.entries(u.status)) {
      info.turns--;
      if (info.turns <= 0) {
        delete u.status[st];
        events.push({ type: 'recover', target: u, text: `${u.name}の${G.STATUS[st].name}が治った。` });
      }
    }
    return events;
  },

  /* ---------- ダメージ計算 ---------- */
  elementMult(target, el) {
    if (!el || el === 'none') return 1;
    if ((target.weak || []).includes(el)) return 1.6;
    if ((target.resist || []).includes(el)) return 0.5;
    return 1;
  },

  calcDamage(actor, target, sk) {
    const kind = sk.kind;
    let atkStat, defStat;
    if (kind === 'phys') {
      atkStat = sk.useDefAsAtk ? G.Battle.stat(actor, 'def') : G.Battle.stat(actor, 'atk');
      defStat = G.Battle.stat(target, 'def');
    } else if (kind === 'mag') {
      atkStat = G.Battle.stat(actor, 'mag');
      defStat = G.Battle.stat(target, 'res');
    } else { // hybrid
      atkStat = (G.Battle.stat(actor, 'atk') + G.Battle.stat(actor, 'mag')) / 2;
      defStat = (G.Battle.stat(target, 'def') + G.Battle.stat(target, 'res')) / 2;
    }
    if (sk.pierce) defStat *= (1 - sk.pierce);

    let dmg = atkStat * ((sk.power || 100) / 100);
    dmg *= 120 / (120 + defStat * 1.5);

    // 属性：スキル属性 → 無ければ武器属性
    const el = sk.el || (kind !== 'mag' ? actor.weaponEl : null) || 'none';
    const em = G.Battle.elementMult(target, el);
    dmg *= em;

    if (sk.vsUndead && ((target.tags || []).includes('undead') || (target.tags || []).includes('demon'))) {
      dmg *= sk.vsUndead;
    }

    // 会心
    const critRate = 0.05 + (sk.critBonus || 0) + G.Battle.modSum(actor, 'crit');
    const crit = G.util.chance(G.util.clamp(critRate, 0, 0.85));
    if (crit) dmg *= 1.8;

    if (target.guarding) dmg *= 0.5;
    dmg *= G.util.rand(0.92, 1.08);

    return { amount: Math.max(1, Math.floor(dmg)), crit, elementMult: em, element: el };
  },

  /* 命中判定 */
  hits(actor, target, sk) {
    if (sk.acc === 1.0) return true;
    let acc = sk.acc || 0.95;
    if (sk.kind === 'phys' || sk.kind === 'hybrid') {
      const blind = G.STATUS.blind;
      if (G.Battle.hasStatus(actor, 'blind')) acc -= blind.missRate;
    }
    acc -= G.Battle.modSum(target, 'eva');
    return G.util.chance(G.util.clamp(acc, 0.05, 1));
  },

  /* ---------- 対象決定 ---------- */
  resolveTargets(b, actor, sk, chosenUid) {
    const foes = G.Battle.alive(G.Battle.enemySide(b, actor));
    const friends = G.Battle.alive(G.Battle.ownSide(b, actor));
    const allFriends = G.Battle.ownSide(b, actor);
    switch (sk.target) {
      case 'all': return foes;
      case 'allies': return friends;
      case 'self': return [actor];
      case 'ally': {
        // 蘇生は戦闘不能者が対象
        const pool = sk.revive ? allFriends.filter(u => u.hp <= 0) : friends;
        const t = pool.find(u => u.uid === chosenUid);
        return t ? [t] : (pool.length ? [pool[0]] : []);
      }
      default: {
        const t = foes.find(u => u.uid === chosenUid);
        return t ? [t] : (foes.length ? [G.util.choice(foes)] : []);
      }
    }
  },

  /* ---------- 行動実行 ----------
   * action: {type:'attack'|'skill'|'item'|'guard'|'flee', skillId, itemId, targetUid}
   * 戻り値: events[] */
  perform(b, actor, action) {
    const ev = [];

    if (action.type === 'guard') {
      actor.guarding = true;
      ev.push({ type: 'guard', actor, text: `${actor.name}は身を守っている。` });
      return ev;
    }

    if (action.type === 'flee') {
      const mySpd = G.Battle.livingAllies(b).reduce((s, u) => s + G.Battle.stat(u, 'spd'), 0) / Math.max(1, G.Battle.livingAllies(b).length);
      const foeSpd = G.Battle.livingEnemies(b).reduce((s, u) => s + G.Battle.stat(u, 'spd'), 0) / Math.max(1, G.Battle.livingEnemies(b).length);
      const rate = G.util.clamp(0.35 + (mySpd - foeSpd) / (foeSpd * 2.5), 0.15, 0.92);
      if (!b.canFlee) {
        ev.push({ type: 'msg', text: '逃げられない！' });
      } else if (G.util.chance(rate)) {
        b.over = true; b.result = 'flee';
        ev.push({ type: 'flee', text: 'うまく逃げ出した！' });
      } else {
        ev.push({ type: 'msg', text: '逃げられなかった！' });
      }
      return ev;
    }

    if (action.type === 'item') {
      return G.Battle.useItem(b, actor, action.itemId, action.targetUid);
    }

    // 通常攻撃はスキル扱いに変換
    const sk = action.type === 'attack'
      ? { name: 'こうげき', kind: 'phys', mp: 0, power: 100, target: 'one', basic: true }
      : G.SKILLS[action.skillId];
    if (!sk) return ev;

    // MP と沈黙のチェック
    if (!sk.basic) {
      if (G.Battle.hasStatus(actor, 'silence')) {
        ev.push({ type: 'msg', text: `${actor.name}は沈黙していて技が使えない！` });
        return ev;
      }
      if (actor.mp < (sk.mp || 0)) {
        ev.push({ type: 'msg', text: `${actor.name}はMPが足りない！` });
        return ev;
      }
      actor.mp -= (sk.mp || 0);
    }

    const targets = G.Battle.resolveTargets(b, actor, sk, action.targetUid);
    ev.push({ type: 'use', actor, skill: sk,
      text: sk.basic ? `${actor.name}のこうげき！` : `${actor.name}は『${sk.name}』を放った！` });

    if (!targets.length) {
      ev.push({ type: 'msg', text: '……しかし対象がいない。' });
      return ev;
    }

    for (const t of targets) {
      ev.push(...G.Battle.applyToTarget(b, actor, t, sk));
    }
    return ev;
  },

  /* スキル1つを1体に適用 */
  applyToTarget(b, actor, target, sk) {
    const ev = [];

    /* --- 回復 --- */
    if (sk.kind === 'heal') {
      const amt = Math.floor(G.Battle.stat(actor, 'mag') * (sk.power / 100) + 8);
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + amt);
      ev.push({ type: 'heal', target, amount: target.hp - before,
        text: `${target.name}のHPが${target.hp - before}回復した。` });
      return ev;
    }

    /* --- 特殊 --- */
    if (sk.kind === 'special') {
      if (sk.revive) {
        if (target.hp > 0) { ev.push({ type: 'msg', text: '……効果がなかった。' }); return ev; }
        target.hp = Math.floor(target.maxHp * sk.revive);
        ev.push({ type: 'revive', target, text: `${target.name}が起き上がった！` });
        return ev;
      }
      if (sk.cureStatus) {
        const had = Object.keys(target.status).length > 0;
        target.status = {};
        ev.push({ type: 'cure', target, text: had ? `${target.name}の状態異常が治った。` : '……効果がなかった。' });
        return ev;
      }
      if (sk.restoreMp) {
        const amt = Math.floor(actor.maxMp * sk.restoreMp);
        const before = actor.mp;
        actor.mp = Math.min(actor.maxMp, actor.mp + amt);
        ev.push({ type: 'mp', target: actor, amount: actor.mp - before,
          text: `${actor.name}のMPが${actor.mp - before}回復した。` });
        return ev;
      }
      if (sk.stealMp) {
        const amt = Math.min(target.mp, Math.floor(target.maxMp * sk.stealMp) + 5);
        target.mp -= amt;
        actor.mp = Math.min(actor.maxMp, actor.mp + amt);
        ev.push({ type: 'mp', target: actor, amount: amt,
          text: amt > 0 ? `${target.name}からMPを${amt}吸い取った。` : '……吸い取れるMPがなかった。' });
        return ev;
      }
      if (sk.fixedRatio) {
        const dmg = Math.max(1, Math.floor(target.hp * sk.fixedRatio));
        target.hp = Math.max(0, target.hp - dmg);
        ev.push({ type: 'damage', target, amount: dmg, text: `${target.name}に${dmg}のダメージ！` });
        if (target.hp <= 0) ev.push(...G.Battle.onDown(b, target));
        return ev;
      }
      if (sk.steal) {
        const drops = (target.drops || []).filter(d => G.ITEMS[d.id]);
        if (drops.length && G.util.chance(0.55)) {
          const got = G.util.choice(drops).id;
          b.stolen.push(got);
          ev.push({ type: 'steal', target, item: got,
            text: `${target.name}から${G.ITEMS[got].name}を盗んだ！` });
        } else {
          ev.push({ type: 'msg', text: '……何も盗めなかった。' });
        }
        return ev;
      }
      if (sk.analyze) {
        target.analyzed = true;
        const w = (target.weak || []).map(e => G.ELEMENTS[e].name).join('・') || 'なし';
        const r = (target.resist || []).map(e => G.ELEMENTS[e].name).join('・') || 'なし';
        ev.push({ type: 'analyze', target,
          text: `${target.name} : HP ${target.hp}/${target.maxHp} ／ 弱点 ${w} ／ 耐性 ${r}` });
        return ev;
      }
    }

    /* --- バフ / デバフ --- */
    if (sk.kind === 'buff' || sk.kind === 'debuff') {
      let applied = false;
      if (sk.buff) {
        for (const [stat, val] of Object.entries(sk.buff)) {
          target.buffs = target.buffs.filter(x => x.stat !== stat);
          target.buffs.push({ stat, val, turns: (sk.turns || 3) + 1 });
          applied = true;
        }
      }
      if (sk.inflict) ev.push(...G.Battle.tryInflict(target, sk.inflict));
      if (sk.power) {
        // 鎧砕きのようにダメージも伴う技
        const d = G.Battle.calcDamage(actor, target, sk);
        target.hp = Math.max(0, target.hp - d.amount);
        ev.push({ type: 'damage', target, amount: d.amount, crit: d.crit, elementMult: d.elementMult,
          text: `${target.name}に${d.amount}のダメージ！` });
        if (target.hp <= 0) ev.push(...G.Battle.onDown(b, target));
      }
      if (applied && !sk.power) {
        const up = sk.kind === 'buff';
        ev.push({ type: 'buff', target, up,
          text: up ? `${target.name}の能力が上がった！` : `${target.name}の能力が下がった！` });
      }
      return ev;
    }

    /* --- 攻撃 --- */
    const hitCount = sk.hits || 1;
    let total = 0, anyHit = false;
    for (let i = 0; i < hitCount; i++) {
      if (target.hp <= 0) break;
      if (!G.Battle.hits(actor, target, sk)) {
        ev.push({ type: 'miss', target, text: `${target.name}にかわされた！` });
        continue;
      }
      anyHit = true;
      const d = G.Battle.calcDamage(actor, target, sk);
      target.hp = Math.max(0, target.hp - d.amount);
      total += d.amount;
      ev.push({ type: 'damage', target, amount: d.amount, crit: d.crit, elementMult: d.elementMult,
        text: `${d.crit ? '会心の一撃！ ' : ''}${target.name}に${d.amount}のダメージ！`
          + (d.elementMult > 1 ? '　弱点を突いた！' : d.elementMult < 1 ? '　効果はいまひとつだ。' : '') });
      // 睡眠は攻撃で解除
      if (target.status.sleep) {
        delete target.status.sleep;
        ev.push({ type: 'recover', target, text: `${target.name}は目を覚ました。` });
      }
    }

    if (anyHit) {
      if (sk.drain && total > 0) {
        const heal = Math.floor(total * sk.drain);
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        ev.push({ type: 'heal', target: actor, amount: heal, text: `${actor.name}はHPを${heal}吸収した。` });
      }
      if (sk.stealGold && actor.side === 'ally') {
        const g = Math.floor((target.gold || 20) * 0.5);
        b.gainedGold += g;
        ev.push({ type: 'gold', amount: g, text: `${g}Gをかすめ取った！` });
      }
      if (sk.inflict) ev.push(...G.Battle.tryInflict(target, sk.inflict));
      if (sk.instantKill && !target.isBoss && target.hp > 0 && G.util.chance(sk.instantKill)) {
        target.hp = 0;
        ev.push({ type: 'damage', target, amount: 0, text: `${target.name}は一撃で消し飛んだ！` });
      }
    }

    if (target.hp <= 0) ev.push(...G.Battle.onDown(b, target));
    return ev;
  },

  tryInflict(target, inf) {
    const ev = [];
    const def = G.STATUS[inf.type];
    if (!def) return ev;
    if (target.status[inf.type]) return ev;
    // ボスは状態異常に強い
    const rate = target.isBoss ? inf.rate * 0.45 : inf.rate;
    if (G.util.chance(rate)) {
      target.status[inf.type] = { turns: (inf.turns || 3) + 1 };
      ev.push({ type: 'status', target, status: inf.type,
        text: `${target.name}は${def.name}状態になった！` });
    }
    return ev;
  },

  onDown(b, u) {
    const ev = [{ type: 'down', target: u,
      text: u.side === 'enemy' ? `${u.name}を倒した！` : `${u.name}は倒れた……` }];
    u.buffs = []; u.status = {};
    return ev;
  },

  /* ---------- 道具 ---------- */
  useItem(b, actor, itemId, targetUid) {
    const ev = [];
    const it = G.ITEMS[itemId];
    if (!it || !it.use) return ev;
    if (!G.State.removeItem(itemId, 1)) {
      ev.push({ type: 'msg', text: 'その道具は持っていない。' });
      return ev;
    }
    const friends = G.Battle.ownSide(b, actor);
    let target = friends.find(u => u.uid === targetUid) || actor;

    ev.push({ type: 'use', actor, text: `${actor.name}は${it.name}を使った。` });

    if (it.use.escape) {
      if (b.canFlee) { b.over = true; b.result = 'flee'; ev.push({ type: 'flee', text: '煙に紛れて逃げ出した！' }); }
      else ev.push({ type: 'msg', text: 'しかし逃げられない！' });
      return ev;
    }
    if (it.use.revive) {
      if (target.hp > 0) { ev.push({ type: 'msg', text: '……効果がなかった。' }); return ev; }
      target.hp = Math.floor(target.maxHp * it.use.revive);
      ev.push({ type: 'revive', target, text: `${target.name}が起き上がった！` });
      return ev;
    }
    if (target.hp <= 0) { ev.push({ type: 'msg', text: '……効果がなかった。' }); return ev; }
    if (it.use.cure) {
      const keys = Object.keys(target.status);
      if (keys.length) { delete target.status[keys[0]];
        ev.push({ type: 'cure', target, text: `${target.name}の${G.STATUS[keys[0]].name}が治った。` }); }
      else ev.push({ type: 'msg', text: '……効果がなかった。' });
      return ev;
    }
    if (it.use.hp) {
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + it.use.hp);
      ev.push({ type: 'heal', target, amount: target.hp - before,
        text: `${target.name}のHPが${target.hp - before}回復した。` });
    }
    if (it.use.mp) {
      const before = target.mp;
      target.mp = Math.min(target.maxMp, target.mp + it.use.mp);
      ev.push({ type: 'mp', target, amount: target.mp - before,
        text: `${target.name}のMPが${target.mp - before}回復した。` });
    }
    return ev;
  },

  /* ---------- 敵AI ---------- */
  enemyAction(b, u) {
    const foes = G.Battle.livingAllies(b);
    if (!foes.length) return { type: 'guard' };

    // 挑発を受けていれば優先的に狙う
    const taunters = foes.filter(f => G.Battle.modSum(f, 'taunt') > 0);
    const pool = taunters.length ? taunters : foes;
    // HPが減っている相手をやや狙いやすい
    const target = G.util.weighted(pool.map(f => ({ f, w: 1 + (1 - f.hp / f.maxHp) * 1.5 }))).f;

    const usable = (u.skills || []).filter(s => G.SKILLS[s.id]);
    if (usable.length && !G.Battle.hasStatus(u, 'silence')) {
      // HPが減っていれば回復技を優先
      const healSkill = usable.find(s => G.SKILLS[s.id].kind === 'heal');
      if (healSkill && u.hp < u.maxHp * 0.35 && G.util.chance(0.7)) {
        return { type: 'skill', skillId: healSkill.id, targetUid: u.uid };
      }
      if (G.util.chance(0.68)) {
        const pickable = usable.filter(s => G.SKILLS[s.id].kind !== 'heal');
        if (pickable.length) {
          const sel = G.util.weighted(pickable.map(s => ({ ...s, w: s.w || 1 })));
          return { type: 'skill', skillId: sel.id, targetUid: target.uid };
        }
      }
    }
    return { type: 'attack', targetUid: target.uid };
  },

  /* ---------- 決着判定 ---------- */
  checkEnd(b) {
    if (b.over) return b.result;
    if (!G.Battle.livingEnemies(b).length) { b.over = true; b.result = 'win'; return 'win'; }
    if (!G.Battle.livingAllies(b).length) { b.over = true; b.result = 'lose'; return 'lose'; }
    return null;
  },

  /* ---------- 戦闘終了処理 ---------- */
  finish(b) {
    // 戦闘中のHP/MPをキャラに書き戻す
    for (const u of b.allies) {
      u.ref.hp = u.hp;
      u.ref.mp = u.mp;
      G.Char.clampVitals(u.ref);
    }

    const out = { result: b.result, exp: 0, gold: 0, drops: [], levelReports: [] };
    if (b.result !== 'win') {
      if (b.result === 'lose') G.State.d.stats.wipes++;
      if (b.result === 'flee') G.State.d.stats.escapes++;
      // 盗んだ物は逃げても残る
      for (const id of b.stolen) { G.State.addItem(id); out.drops.push(id); }
      if (b.gainedGold) { G.State.addGold(b.gainedGold); out.gold += b.gainedGold; }
      return out;
    }

    G.State.d.stats.wins++;

    // 魔物学の習熟で経験値とドロップ率にボーナス
    const mono = (G.State.d.subjects.monsterology || 0) / 100;
    const expMult = 1 + mono * 0.25;
    const dropMult = 1 + mono * 0.5;

    let exp = 0, gold = 0;
    for (const e of b.enemies) { exp += e.exp || 0; gold += e.gold || 0; }
    exp = Math.floor(exp * expMult);

    const goldBonus = G.State.d.party.reduce((s, c) => s + G.Char.equipBonus(c, 'goldBonus'), 0);
    gold = Math.floor(gold * (1 + goldBonus)) + b.gainedGold;

    const drops = b.stolen.slice();
    for (const e of b.enemies) {
      for (const d of (e.drops || [])) {
        if (G.util.chance(Math.min(1, d.rate * dropMult))) drops.push(d.id);
      }
    }

    G.State.addGold(gold);
    for (const id of drops) G.State.addItem(id);
    out.exp = exp; out.gold = gold; out.drops = drops;
    out.levelReports = G.State.partyExp(exp);
    return out;
  },
};
