import { CATEGORY_BY_ID, COLOR_TIPS, HUBS, UNIVERSAL_HUB_INDUSTRIES, categorize, type CategoryId } from './industries';
import { staffNames, statusGroup, type Company, type Order } from './model';

export interface Query {
  /** 繋がりたい業界・キーワード（空白・読点区切りで複数可） */
  text: string;
  /** 大分類チップで選んだ業界 */
  categories: CategoryId[];
  prefecture: string;
  /** active: 支援中のみ / current: 解約を除く / all: すべて */
  status: 'active' | 'current' | 'all';
  /** 橋渡し役（関連業界の企業）も含めるか */
  includeHubs: boolean;
  requireContact: boolean;
  /** 担当者名（部分一致。空なら絞り込まない） */
  staff: string;
  staffScope: 'support' | 'any';
}

export type ReasonKind = 'match' | 'hub' | 'relation' | 'contact' | 'caution';

export interface Reason {
  kind: ReasonKind;
  text: string;
}

export interface Recommendation {
  company: Company;
  score: number;
  /** direct: その業界の企業そのもの / hub: その業界とつながりを持つ橋渡し役 */
  type: 'direct' | 'hub';
  reasons: Reason[];
  tip: string;
}

export function splitTerms(text: string): string[] {
  return [...new Set(text.split(/[\s、,，・/／]+/).map((t) => t.trim()).filter(Boolean))];
}

/** 入力から「探したい大分類」を決める（チップで選んだもの＋キーワードから推定したもの） */
export function targetCategories(q: Query): CategoryId[] {
  const set = new Set<CategoryId>(q.categories);
  for (const t of splitTerms(q.text)) categorize(t).forEach((c) => set.add(c));
  return [...set];
}

function snippet(text: string, term: string): string {
  const i = text.indexOf(term);
  if (i < 0) return '';
  const start = Math.max(0, i - 18);
  const end = Math.min(text.length, i + term.length + 22);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : '');
}

function yearsSince(date: string, now: Date): number {
  const t = Date.parse(date);
  return Number.isNaN(t) ? Infinity : (now.getTime() - t) / (365.25 * 24 * 3600 * 1000);
}

/** 地域・取引状況・連絡先の条件に合う企業か（おすすめ検索と業界別グラフで共通） */
export function passesFilters(c: Company, q: Pick<Query, 'status' | 'prefecture' | 'requireContact'>): boolean {
  const anyActive = c.orders.some((o) => statusGroup(o.status) === 'active');
  if (q.status === 'active' && !anyActive) return false;
  if (q.status === 'current' && !anyActive && statusGroup(c.orders[0]?.status ?? '') === 'cancelled') return false;
  if (q.prefecture && c.prefecture !== q.prefecture) return false;
  if (q.requireContact && !c.phone && !c.hp && !c.email) return false;
  return true;
}

export function recommend(companies: Company[], q: Query, now = new Date()): Recommendation[] {
  const terms = splitTerms(q.text);
  const targets = targetCategories(q);
  const staff = q.staff.trim();
  if (!terms.length && !targets.length && !staff) return [];

  // 橋渡し役になれる大分類と、その理由
  const hubWhy = new Map<CategoryId, string[]>();
  for (const t of targets) {
    for (const h of HUBS[t] ?? []) {
      const list = hubWhy.get(h.hub) ?? [];
      list.push(`${CATEGORY_BY_ID[t].label}業界と「${h.why}」`);
      hubWhy.set(h.hub, list);
    }
  }
  const targetLabels = targets.map((t) => CATEGORY_BY_ID[t].label).join('・') || terms.join('・');

  const out: Recommendation[] = [];
  for (const c of companies) {
    const group = statusGroup(c.orders[0]?.status ?? '');
    if (!passesFilters(c, q)) continue;
    let staffOrder: Order | undefined;
    let staffName = '';
    if (staff) {
      for (const o of c.orders) {
        staffName = staffNames(o, q.staffScope).find((n) => n.includes(staff)) ?? '';
        if (staffName) {
          staffOrder = o;
          break;
        }
      }
      if (!staffOrder) continue;
    }

    const reasons: Reason[] = [];
    let fit = 0;
    let type: 'direct' | 'hub' = 'direct';

    // 1) キーワード一致（業種 > 商品・サービス > 会社紹介文 > 企業名）
    for (const term of terms) {
      if (c.industry.includes(term)) {
        fit += 60;
        reasons.push({ kind: 'match', text: `業種が「${c.industry}」で「${term}」に直接該当します` });
      } else if (c.products.includes(term)) {
        fit += 45;
        reasons.push({ kind: 'match', text: `扱うサービス・商品「${c.products.slice(0, 40)}」が「${term}」に該当します` });
      } else if (c.summary.includes(term) || c.note.includes(term)) {
        fit += 30;
        reasons.push({ kind: 'match', text: `受注時の記録に「${term}」の記載があります（${snippet(c.summary.includes(term) ? c.summary : c.note, term)}）` });
      } else if (c.name.includes(term)) {
        fit += 25;
        reasons.push({ kind: 'match', text: `企業名に「${term}」を含みます` });
      }
    }

    // 2) 大分類の一致
    const matchedCats = c.categories.filter((cat) => targets.includes(cat));
    if (matchedCats.length) {
      const already = reasons.some((r) => r.kind === 'match');
      fit += already ? 10 : 40;
      if (!already) {
        reasons.push({
          kind: 'match',
          text: `業種「${c.industry || c.products}」は${matchedCats.map((m) => CATEGORY_BY_ID[m].label).join('・')}業界に該当します`,
        });
      }
    }

    // 3) 橋渡し役（関連業界・顧問先の多い業種）
    if (!fit && q.includeHubs) {
      // 業種から分類できる場合はそれを優先し、商品・サービス名からの推定は補助に使う
      const ownCats = categorize(c.industry);
      const hubCat = (ownCats.length ? ownCats : c.categories).find((cat) => hubWhy.has(cat));
      const universal = UNIVERSAL_HUB_INDUSTRIES.find((w) => c.industry.includes(w));
      if (hubCat) {
        fit += 22;
        type = 'hub';
        const label = CATEGORY_BY_ID[hubCat].label;
        const basis = ownCats.length ? `「${c.industry}」（${label}）` : `「${c.products.slice(0, 30)}」を扱う${label}系`;
        reasons.push({ kind: 'hub', text: `${basis}の企業は、${hubWhy.get(hubCat)![0]}ため、紹介の橋渡し役になりやすい` });
      } else if (universal) {
        fit += 15;
        type = 'hub';
        reasons.push({ kind: 'hub', text: `「${c.industry}」は業界を問わず多くの顧問先・顧客を持つため、${targetLabels}の企業を紹介してもらえる可能性があります` });
      }
    }
    // 業界の指定がなく担当者だけで探すときは、その担当者の企業をすべて候補にする
    if (!terms.length && !targets.length) fit = 10;
    if (!fit) continue;
    if (staffOrder) {
      const role = staffOrder.supporters?.includes(staffName) ? '支援担当' : staffOrder.manager === staffName ? '責任者' : '受注担当';
      reasons.unshift({
        kind: 'relation',
        text: `${staffName}さんが${role}（${staffOrder.date || '日付なし'}・${staffOrder.service}）で、直接お願いしやすい関係です`,
      });
    }

    // 4) アイドマとの関係の深さ（紹介をお願いしやすいか）
    let rel = 0;
    const activeOrder = c.orders.find((o) => statusGroup(o.status) === 'active');
    if (activeOrder) {
      rel += 20;
      reasons.push({
        kind: 'relation',
        text: `現在アイドマが支援中（${activeOrder.status}・${activeOrder.service}）で、担当の${activeOrder.supporters?.length ? activeOrder.supporters.join('・') : activeOrder.owner || '社内担当者'}さん経由で相談しやすい`,
      });
    }
    if (c.orders.length >= 2) {
      rel += Math.min(15, c.orders.length * 3);
      reasons.push({ kind: 'relation', text: `受注実績が${c.orders.length}件あり（追加・更新を含む）、継続的な信頼関係があります` });
    }
    const latest = c.orders[0]?.date ?? '';
    const age = yearsSince(latest, now);
    if (age <= 1) {
      rel += 10;
      if (!activeOrder) reasons.push({ kind: 'relation', text: `${latest} に受注した最近の取引先で、関係が温かいうちに声をかけられます` });
    } else if (age <= 2) rel += 5;
    const total = c.orders.reduce((s, o) => s + o.amount, 0);
    if (total >= 3_000_000) {
      rel += 8;
      reasons.push({ kind: 'relation', text: `累計受注額 ${Math.round(total / 10000).toLocaleString()}万円の重要顧客です` });
    }
    if (c.employees && c.employees >= 50) {
      rel += 5;
      reasons.push({ kind: 'relation', text: `従業員${c.employees.toLocaleString()}名規模で、取引先のネットワークが広いと見込めます` });
    }
    if (q.prefecture) reasons.push({ kind: 'relation', text: `${c.prefecture}の企業で、地域内の紹介につなげやすい` });

    // 5) 連絡先の揃い具合
    const contacts = [c.phone && '代表電話', c.email && 'メール', c.hp && 'HP'].filter(Boolean);
    if (contacts.length) {
      rel += contacts.length * 2;
      if (contacts.length >= 2) reasons.push({ kind: 'contact', text: `${contacts.join('・')}が登録済みで、すぐに調査・連絡できます` });
    }

    // 6) 注意点
    if (group === 'cancelled' && !activeOrder) {
      rel -= 15;
      reasons.push({ kind: 'caution', text: '直近の契約は解約になっています。紹介を依頼する前に担当者へ経緯を確認してください' });
    }

    const colorKey = Object.keys(COLOR_TIPS).find((k) => c.color.startsWith(k));
    out.push({
      company: c,
      score: fit + rel,
      type,
      reasons,
      tip: colorKey ? `社長タイプ「${c.color}」：${COLOR_TIPS[colorKey]}` : '',
    });
  }

  return out.sort((a, b) => b.score - a.score || (b.company.orders[0]?.date ?? '').localeCompare(a.company.orders[0]?.date ?? ''));
}
