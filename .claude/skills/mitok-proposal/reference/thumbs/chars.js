// Flat illustration characters shared by all thumbnails (inline SVG strings)
const SKIN = "#F6D2B8";

function daughter(size = 300) {
  return `<svg width="${size}" height="${size * 1.25}" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 250 Q40 165 100 160 Q160 165 160 250 Z" fill="#F08A5D"/>
    <path d="M85 150 h30 v22 h-30z" fill="${SKIN}"/>
    <path d="M52 95 Q50 40 100 38 Q150 40 148 95 L152 150 Q130 160 118 130 L82 130 Q70 160 48 150 Z" fill="#4A3228"/>
    <ellipse cx="100" cy="98" rx="40" ry="46" fill="${SKIN}"/>
    <path d="M58 88 Q70 48 108 52 Q140 56 144 90 Q120 70 96 72 Q74 74 58 88Z" fill="#4A3228"/>
    <path d="M80 100 q6 -5 12 0" stroke="#3A2A22" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M108 100 q6 -5 12 0" stroke="#3A2A22" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M92 122 q8 5 16 0" stroke="#C0604A" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="74" cy="114" r="6" fill="#F4A99A" opacity=".6"/><circle cx="126" cy="114" r="6" fill="#F4A99A" opacity=".6"/>
  </svg>`;
}

function staff(size = 300) {
  return `<svg width="${size}" height="${size * 1.25}" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
    <path d="M36 250 Q38 162 100 158 Q162 162 164 250 Z" fill="#1F5E5B"/>
    <path d="M84 158 L100 182 L116 158 Z" fill="#FFFFFF"/>
    <rect x="118" y="196" width="30" height="20" rx="4" fill="#FFFFFF"/>
    <path d="M86 146 h28 v20 h-28z" fill="${SKIN}"/>
    <ellipse cx="100" cy="98" rx="40" ry="46" fill="${SKIN}"/>
    <path d="M58 96 Q54 46 100 44 Q148 46 142 96 Q136 70 112 66 Q84 64 66 76 Q60 84 58 96Z" fill="#2B2B2B"/>
    <circle cx="84" cy="100" r="5" fill="#2B2B2B"/><circle cx="116" cy="100" r="5" fill="#2B2B2B"/>
    <path d="M88 120 q12 10 24 0" stroke="#B5533F" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function elder(size = 300) {
  return `<svg width="${size}" height="${size * 1.25}" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
    <path d="M34 250 Q36 166 100 162 Q164 166 166 250 Z" fill="#8FB8A8"/>
    <path d="M100 166 L100 250" stroke="#6E9C8B" stroke-width="4"/>
    <circle cx="92" cy="200" r="4" fill="#FFFFFF"/><circle cx="92" cy="222" r="4" fill="#FFFFFF"/>
    <path d="M86 148 h28 v22 h-28z" fill="${SKIN}"/>
    <ellipse cx="100" cy="100" rx="42" ry="46" fill="${SKIN}"/>
    <path d="M58 100 Q52 52 100 50 Q148 52 142 100 Q140 78 124 70 Q100 82 76 70 Q60 80 58 100Z" fill="#D9D9D9"/>
    <circle cx="84" cy="104" r="11" fill="none" stroke="#6B5B4E" stroke-width="3"/>
    <circle cx="116" cy="104" r="11" fill="none" stroke="#6B5B4E" stroke-width="3"/>
    <path d="M95 104 h10" stroke="#6B5B4E" stroke-width="3"/>
    <circle cx="84" cy="104" r="3.5" fill="#3A2A22"/><circle cx="116" cy="104" r="3.5" fill="#3A2A22"/>
    <path d="M88 126 q12 9 24 0" stroke="#B5533F" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function heart(size = 60, color = "#E07B39") {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="${color}" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.8 4.5c2.1 0 3.6 1.1 4.2 2.4.6-1.3 2.1-2.4 4.2-2.4 3.8 0 5.9 3.8 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>`;
}

function house(size = 200, color = "#1F5E5B") {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><path d="M50 12 L90 46 H80 V88 H20 V46 H10 Z" fill="${color}"/><rect x="42" y="60" width="16" height="28" rx="2" fill="#FFFFFF"/>${""}</svg>`;
}


function teacher(size = 300) {
  return `<svg width="${size}" height="${size * 1.25}" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
    <path d="M38 250 Q40 164 100 160 Q160 164 162 250 Z" fill="#2F7A55"/>
    <path d="M78 162 L100 200 L122 162 Z" fill="#FFFFFF"/>
    <circle cx="140" cy="206" r="9" fill="#F6B3AA"/>
    <path d="M86 148 h28 v22 h-28z" fill="${SKIN}"/>
    <path d="M50 100 Q46 42 100 40 Q154 42 150 100 L150 140 Q128 146 124 120 L76 120 Q72 146 50 140 Z" fill="#5A3B2C"/>
    <ellipse cx="100" cy="100" rx="40" ry="46" fill="${SKIN}"/>
    <path d="M58 92 Q62 50 104 52 Q142 56 144 92 Q128 70 100 72 Q76 70 58 92Z" fill="#5A3B2C"/>
    <circle cx="84" cy="104" r="12" fill="none" stroke="#2F7A55" stroke-width="3"/>
    <circle cx="116" cy="104" r="12" fill="none" stroke="#2F7A55" stroke-width="3"/>
    <path d="M96 104 h8" stroke="#2F7A55" stroke-width="3"/>
    <circle cx="84" cy="104" r="3.5" fill="#2B2B2B"/><circle cx="116" cy="104" r="3.5" fill="#2B2B2B"/>
    <path d="M88 124 q12 9 24 0" stroke="#C0604A" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="70" cy="118" r="6" fill="#F4A99A" opacity=".5"/><circle cx="130" cy="118" r="6" fill="#F4A99A" opacity=".5"/>
  </svg>`;
}

function child(size = 300) {
  return `<svg width="${size}" height="${size * 1.25}" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
    <path d="M52 250 Q54 180 100 176 Q146 180 148 250 Z" fill="#F2C94C"/>
    <path d="M88 166 h24 v16 h-24z" fill="${SKIN}"/>
    <ellipse cx="100" cy="124" rx="44" ry="48" fill="${SKIN}"/>
    <path d="M56 120 Q52 70 100 70 Q148 70 144 120 Q136 94 112 92 Q96 104 72 96 Q60 104 56 120Z" fill="#3A2A22"/>
    <circle cx="84" cy="128" r="5" fill="#2B2B2B"/><circle cx="116" cy="128" r="5" fill="#2B2B2B"/>
    <path d="M92 148 q8 4 16 0" stroke="#C0604A" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="70" cy="142" r="7" fill="#F4A99A" opacity=".6"/><circle cx="130" cy="142" r="7" fill="#F4A99A" opacity=".6"/>
  </svg>`;
}

function worker(size = 300) {
  return `<svg width="${size}" height="${size * 1.25}" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
    <path d="M36 250 Q38 162 100 158 Q162 162 164 250 Z" fill="#1F5F8B"/>
    <path d="M86 158 L100 180 L114 158 Z" fill="#FFFFFF"/>
    <rect x="116" y="194" width="32" height="20" rx="4" fill="#FFFFFF"/>
    <path d="M86 146 h28 v20 h-28z" fill="${SKIN}"/>
    <ellipse cx="100" cy="100" rx="40" ry="46" fill="${SKIN}"/>
    <path d="M60 96 Q60 70 76 66 L124 66 Q140 70 140 96 Q130 84 100 84 Q70 84 60 96Z" fill="#2B2B2B"/>
    <path d="M54 72 Q56 36 100 36 Q144 36 146 72 Z" fill="#E08A3C"/>
    <path d="M50 70 h112 q4 0 4 5 q0 5 -4 5 h-112 q-4 0 -4 -5 q0 -5 4 -5z" fill="#C8742C"/>
    <circle cx="84" cy="102" r="5" fill="#2B2B2B"/><circle cx="116" cy="102" r="5" fill="#2B2B2B"/>
    <path d="M88 122 q12 10 24 0" stroke="#B5533F" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function accountant(size = 300) {
  return `<svg width="${size}" height="${size * 1.25}" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
    <path d="M36 250 Q38 162 100 158 Q162 162 164 250 Z" fill="#262A52"/>
    <path d="M80 160 L100 250 L120 160 Z" fill="#FFFFFF"/>
    <path d="M95 168 L105 168 L108 215 L100 226 L92 215 Z" fill="#D4A437"/>
    <path d="M80 160 L100 200 L70 200 Z" fill="#3A3F73"/><path d="M120 160 L100 200 L130 200 Z" fill="#3A3F73"/>
    <path d="M86 146 h28 v20 h-28z" fill="${SKIN}"/>
    <ellipse cx="100" cy="100" rx="40" ry="46" fill="${SKIN}"/>
    <path d="M58 98 Q52 48 100 46 Q150 48 142 98 Q138 72 118 66 Q96 76 70 70 Q60 80 58 98Z" fill="#3A3A3A"/>
    <circle cx="84" cy="102" r="5" fill="#2B2B2B"/><circle cx="116" cy="102" r="5" fill="#2B2B2B"/>
    <path d="M88 122 q12 9 24 0" stroke="#B5533F" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
}

module.exports = { accountant, worker, daughter, staff, elder, heart, house, teacher, child, mother: daughter };
