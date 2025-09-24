// 1) 차트 기본 설정
const margin = { top: 40, right: 30, bottom: 55, left: 80 };
const width = 1200 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// 2) SVG
const svg = d3.select("#area-chart")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// 3) Tooltip
const tooltip = d3.select("body").append("div").attr("class", "tooltip");

// 4) 데이터 경로/출시일/이벤트
const worldDataPath = "data/world_data.csv";
const wildsDataPath = "data/wilds_data.csv";

const releaseDates = {
  world: new Date("2018-08-09"),
  wilds: new Date("2025-02-28"),
};

const events = [
  { date: "2018-09-06", label: "PC 최적화 패치", game: "world" },
  { date: "2020-01-09", label: "아이스본 출시", game: "world" },
  // 필요시 Wilds 이벤트를 여기에 추가
];

// 5) 데이터 로드
Promise.all([d3.csv(worldDataPath), d3.csv(wildsDataPath)]).then(([worldData, wildsData]) => {
  // 파싱 & 정렬: ★ 가장 중요
  const parse = (d) => ({ days: +d.days, players: +d.players });
  worldData = worldData.map(parse).filter(d => Number.isFinite(d.days) && Number.isFinite(d.players));
  wildsData = wildsData.map(parse).filter(d => Number.isFinite(d.days) && Number.isFinite(d.players));

  worldData.sort((a, b) => a.days - b.days);
  wildsData.sort((a, b) => a.days - b.days);

  // 6) 스케일
  const maxDays = Math.max(
    d3.max(worldData, d => d.days) ?? 0,
    d3.max(wildsData, d => d.days) ?? 0
  );

  const maxPlayers = Math.max(
    d3.max(worldData, d => d.players) ?? 1,
    d3.max(wildsData, d => d.players) ?? 1
  );

  const x = d3.scaleLinear().domain([0, maxDays]).range([0, width]);
  const y = d3.scaleLog()
    .domain([Math.max(1, Math.min(1000, maxPlayers / 1000)), maxPlayers]) // 최소값 안전 처리
    .range([height, 0])
    .clamp(true);

  // 7) 축
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .append("text")
    .attr("x", width / 2)
    .attr("y", 45)
    .attr("fill", "#000")
    .attr("font-weight", "bold")
    .attr("text-anchor", "middle")
    .text("출시 후 경과일 (Days after release)");

  svg.append("g")
    .call(
      d3.axisLeft(y)
        .ticks(6, d => (d >= 1_000_000 ? `${d / 1_000_000}M` : `${d / 1000}k`))
    )
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -60)
    .attr("fill", "#000")
    .attr("font-weight", "bold")
    .attr("text-anchor", "middle")
    .text("동시 접속자 수 (로그 스케일)");

  // 8) Area & Line 생성기
  const definedThreshold = 1; // log 스케일 하한을 이미 clamp 했으므로 1로 완화
  const area = d3.area()
    .x(d => x(d.days))
    .y0(height)
    .y1(d => y(Math.max(definedThreshold, d.players)))
    .curve(d3.curveMonotoneX)
    .defined(d => d.players >= definedThreshold);

  const line = d3.line()
    .x(d => x(d.days))
    .y(d => y(Math.max(definedThreshold, d.players)))
    .curve(d3.curveMonotoneX)
    .defined(d => d.players >= definedThreshold);

  // 9) 영역 + 선 (World → Wilds 순서로 겹침)
  svg.append("path")
    .datum(worldData)
    .attr("fill", "#405d7b")
    .attr("opacity", 0.7)
    .attr("d", area);

  svg.append("path")
    .datum(worldData)
    .attr("fill", "none")
    .attr("stroke", "#2c3e50")
    .attr("stroke-width", 1.5)
    .attr("d", line);

  svg.append("path")
    .datum(wildsData)
    .attr("fill", "#d95f02")
    .attr("opacity", 0.6)
    .attr("d", area);

  svg.append("path")
    .datum(wildsData)
    .attr("fill", "none")
    .attr("stroke", "#9a3f00")
    .attr("stroke-width", 1.5)
    .attr("d", line);

  // 10) 이벤트 주석 (출시일 기준 day 계산 후, 범위 내만 표시)
  const dayFromRelease = (iso, game) => {
    const t = (new Date(iso) - releaseDates[game]) / (1000 * 60 * 60 * 24);
    return Math.floor(t);
  };

  events.forEach(ev => {
    const dday = dayFromRelease(ev.date, ev.game);
    if (dday < 0 || dday > maxDays) return; // 범위 밖이면 스킵
    const xx = x(dday);

    svg.append("line")
      .attr("class", "event-line")
      .attr("x1", xx).attr("x2", xx)
      .attr("y1", 0).attr("y2", height);

    svg.append("text")
      .attr("class", "event-label")
      .attr("x", xx)
      .attr("y", 12)
      .text(ev.label)
      .attr("transform", `translate(0,0)`)
      .attr("text-anchor", "start")
      .attr("dx", 6);
  });

  // 11) 통합 툴팁 (경계 보정)
  const focus = svg.append("g").style("opacity", 0);
  focus.append("line").attr("class", "focus-line").attr("y1", 0).attr("y2", height);
  const worldDot = focus.append("circle").attr("r", 4).attr("class", "focus-circle");
  const wildsDot = focus.append("circle").attr("r", 4).attr("class", "focus-circle");

  const bisect = d3.bisector(d => d.days).left;

  svg.append("rect")
    .attr("class", "listening-rect")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "none")
    .style("pointer-events", "all")
    .on("mouseover", () => { focus.style("opacity", 1); tooltip.style("opacity", 1); })
    .on("mouseout", () => { focus.style("opacity", 0); tooltip.style("opacity", 0); })
    .on("mousemove", (event) => {
      const mouseX = d3.pointer(event)[0];
      const xDay = x.invert(mouseX);

      // 각 시리즈에서 가장 가까운 점 찾기 (경계 보정)
      const pick = (arr) => {
        let i = Math.max(1, Math.min(arr.length - 1, bisect(arr, xDay)));
        const a0 = arr[i - 1], a1 = arr[i];
        if (!a0 || !a1) return a0 || a1;
        return (xDay - a0.days) < (a1.days - xDay) ? a0 : a1;
      };

      const pw = worldData.length ? pick(worldData) : null;
      const pz = wildsData.length ? pick(wildsData) : null;
      if (!pw && !pz) return;

      const anchor = (pw && pz)
        ? (Math.abs(pw.days - xDay) <= Math.abs(pz.days - xDay) ? pw.days : pz.days)
        : (pw ? pw.days : pz.days);

      focus.attr("transform", `translate(${x(anchor)},0)`);

      if (pw) {
        worldDot.style("opacity", 1).attr("cy", y(Math.max(definedThreshold, pw.players)));
      } else worldDot.style("opacity", 0);

      if (pz) {
        wildsDot.style("opacity", 1).attr("cy", y(Math.max(definedThreshold, pz.players)));
      } else wildsDot.style("opacity", 0);

      tooltip.html(
        `<strong>Day ${anchor}</strong><br/>
         <span style="color:#405d7b">World:</span> ${pw ? pw.players.toLocaleString() : "N/A"}<br/>
         <span style="color:#d95f02">Wilds:</span> ${pz ? pz.players.toLocaleString() : "N/A"}`
      )
      .style("left", (event.pageX + 14) + "px")
      .style("top", (event.pageY - 28) + "px");
    });

}).catch(err => {
  console.error("데이터 로딩/처리 오류:", err);
});
