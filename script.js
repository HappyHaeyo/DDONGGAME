// ===== 1) 차트 기본 설정 =====
const margin = { top: 40, right: 30, bottom: 55, left: 80 };
const width  = 1200 - margin.left - margin.right;
const height = 600  - margin.top  - margin.bottom;

// ===== 2) SVG =====
const svg = d3.select("#area-chart")
  .attr("width",  width  + margin.left + margin.right)
  .attr("height", height + margin.top  + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// ===== 3) Tooltip =====
const tooltip = d3.select("body").append("div").attr("class", "tooltip");

// ===== 4) 데이터 경로 / 출시일 / 이벤트 =====
const worldDataPath = "data/world_data.csv";
const wildsDataPath = "data/wilds_data.csv";

const releaseDates = {
  world: new Date("2018-08-09"),
  wilds: new Date("2025-02-28"),
};

const events = [
  { date: "2018-09-06", label: "PC 최적화 패치", game: "world" },
  { date: "2020-01-09", label: "아이스본 출시",   game: "world" },
  // { date: "2025-XX-XX", label: "콘텐츠 업데이트", game: "wilds" },
];

// ===== 5) 데이터 로드 =====
Promise.all([d3.csv(wildsDataPath), d3.csv(worldDataPath)])
  .then(([wildsData, worldData]) => {

    // 파싱 + 정렬
    const toNum = d => ({ days: +d.days, players: +d.players });
    wildsData = wildsData.map(toNum).filter(d => Number.isFinite(d.days) && Number.isFinite(d.players))
                         .sort((a,b)=>a.days-b.days);
    worldData = worldData.map(toNum).filter(d => Number.isFinite(d.days) && Number.isFinite(d.players))
                         .sort((a,b)=>a.days-b.days);

    // 스케일 범위 계산
    const maxDays = Math.max(
      d3.max(wildsData, d => d.days) ?? 0,
      d3.max(worldData, d => d.days) ?? 0
    );

    const maxPlayers = Math.max(
      d3.max(wildsData, d => d.players) ?? 1,
      d3.max(worldData, d => d.players) ?? 1
    );

    // 로그 축 하한: 데이터 특성에 맞게 조정하고 싶으면 숫자만 바꾸면 됨
    const minY = 1000; // <- 필요시 10000 등으로 변경

    const x = d3.scaleLinear().domain([0, maxDays]).range([0, width]);
    const y = d3.scaleLog().domain([minY, maxPlayers]).range([height, 0]).clamp(true);

    // ===== 6) 축 =====
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .append("text")
      .attr("x", width/2).attr("y", 45)
      .attr("fill", "#000").attr("font-weight", "bold").attr("text-anchor", "middle")
      .text("출시 후 경과일 (Days after release)");

    svg.append("g")
      .call(d3.axisLeft(y).ticks(6, d => (d>=1_000_000? `${d/1_000_000}M` : `${d/1000}k`)))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height/2).attr("y", -60)
      .attr("fill", "#000").attr("font-weight", "bold").attr("text-anchor", "middle")
      .text("동시 접속자 수 (로그 스케일)");

    // ===== 7) Area & Line (y0를 '축 하한'으로 — 핵심 수정) =====
    const ySafe = v => y(Math.max(minY, v));

    const area = d3.area()
      .x(d => x(d.days))
      .y0(() => y(minY))           // ★ 바닥을 height가 아니라 '로그 축의 하한'으로
      .y1(d => ySafe(d.players))
      .curve(d3.curveMonotoneX);

    const line = d3.line()
      .x(d => x(d.days))
      .y(d => ySafe(d.players))
      .curve(d3.curveMonotoneX);

    // ===== 8) 그리기 순서 (Wilds 먼저, World 나중 → World가 위에 보임) =====
    svg.append("path").datum(wildsData)
      .attr("fi
