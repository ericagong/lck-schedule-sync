// 배포된 ICS를 GitHub Pages에서 즉시 확인.
// 사용법: pnpm view:ics <팀코드>
//
// last-modified 헤더로 배포 시점(KST) + 매치 수·크기 요약 + ICS 전체 출력.
// CDN 캐시 우회를 위해 쿼리스트링에 timestamp를 붙임.

const BASE_URL = 'https://ericagong.github.io/lck-teams-schedule';
const VALID_TEAMS = ['t1', 'gen', 'hle', 'dk', 'kt', 'krx', 'bro', 'bfx', 'ns', 'dns'] as const;
type TeamCode = (typeof VALID_TEAMS)[number];

const team = process.argv[2]?.toLowerCase();
if (!team || !VALID_TEAMS.includes(team as TeamCode)) {
  console.error(team ? `알 수 없는 팀코드: "${team}"` : '팀코드 인자가 필요합니다.');
  console.error(`사용법: pnpm view:ics <${VALID_TEAMS.join('|')}>`);
  process.exit(1);
}

const url = `${BASE_URL}/${team}.ics?t=${Date.now()}`;
const res = await fetch(url);
if (!res.ok) {
  console.error(`HTTP ${res.status} — ${url}`);
  process.exit(1);
}

const lastModified = res.headers.get('last-modified');
const kst = lastModified
  ? new Date(lastModified).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour12: false,
    })
  : '(unknown)';

const body = await res.text();
const matchCount = (body.match(/^BEGIN:VEVENT/gm) ?? []).length;
const sizeKB = (body.length / 1024).toFixed(1);

console.log(`# ${team}.ics — 배포 시점: ${kst} KST`);
console.log(`# 매치 수: ${matchCount} | 크기: ${sizeKB} KB | URL: ${BASE_URL}/${team}.ics`);
console.log('');
console.log(body);
