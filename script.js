// 1. 차트 기본 설정
const margin = { top: 40, right: 30, bottom: 50, left: 70 };
const width = 1000 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// 2. SVG 요소 설정
const svg = d3.select("#area-chart")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// 3. 팝업(툴팁) div 생성
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip");

// 4. 데이터 로드 경로
const worldDataPath = 'data/world_data.csv';
const wildsDataPath = 'data/wilds_data.csv';

// 몬스터 헌터: 월드 PC 출시일
const mhwReleaseDate = new Date("2018-08-09");

// ⭐ 주요 이벤트 데이터: 여기에 원하는 이벤트를 추가하거나 수정하세요.
const events = [
    { date: "2018-09-06", label: "PC 최적화 패치" },
    { date: "2018-11-22", label: "신규 컨텐츠 (쿨베 타로트)" },
    { date: "2020-01-09", label: "아이스본 출시 (PC)" },
    { date: "2025-02-28", label: "와일즈 출시" }
];
const parseEventDate = d3.timeParse("%Y-%m-%d");
events.forEach(d => {
    d.date = parseEventDate(d.date);
});


// 5. 데이터 로드 및 전처리
Promise.all([
    d3.csv(worldDataPath),
    d3.csv(wildsDataPath)
]).then(([worldData, wildsData]) => {
    
    // 데이터 파서 정의
    const parseWorldData = d => {
        const date = new Date(mhwReleaseDate);
        date.setDate(date.getDate() + +d['Release after day']); // 'Release after day'를 더해 날짜 계산
        return {
            date: date,
            value: +d.Players // Players 컬럼 사용
        };
    };

    const parseWildsData = d => {
        return {
            date: d3.timeParse("%Y-%m-%d %H:%M:%S")(d.DateTime), // DateTime 컬럼 사용
            value: +d.Players
        };
    };
    
    const processedWorldData = worldData.map(parseWorldData);
    const processedWildsData = wildsData.map(parseWildsData);

    // 6. X, Y축 스케일 설정
    const allData = [...processedWorldData, ...processedWildsData];
    
    const xScale = d3.scaleTime()
        .domain(d3.extent(allData, d => d.date))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(allData, d => d.value)])
        .range([height, 0]);

    // 7. 축 생성
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y년")));

    svg.append("g")
        .call(d3.axisLeft(yScale).tickFormat(d => `${d / 1000}k`)); // 단위를 천(k)으로 표시

    // 8. 영역(Area) 생성기
    const areaGenerator = d3.area()
        .x(d => xScale(d.date))
        .y0(yScale(0))
        .y1(d => yScale(d.value));

    // 9. 영역 그리기
    // 월드 데이터
    svg.append("path")
        .datum(processedWorldData)
        .attr("fill", "#405d7b")
        .attr("opacity", 0.7)
        .attr("d", areaGenerator);
    
    // 와일즈 데이터
    svg.append("path")
        .datum(processedWildsData)
        .attr("fill", "#d95f02")
        .attr("opacity", 0.7)
        .attr("d", areaGenerator);

    // 10. 이벤트 마커 추가
    const eventMarkers = svg.append("g").attr("class", "event-markers");

    eventMarkers.selectAll(".event-line")
        .data(events)
        .enter()
        .append("line")
        .attr("class", "event-line")
        .attr("x1", d => xScale(d.date))
        .attr("x2", d => xScale(d.date))
        .attr("y1", margin.top - 20)
        .attr("y2", height);

    eventMarkers.selectAll(".event-label")
        .data(events)
        .enter()
        .append("text")
        .attr("class", "event-label")
        .attr("x", d => xScale(d.date))
        .attr("y", margin.top - 25)
        .text(d => d.label);
        
    // 11. 툴팁 기능 (마우스 오버)
    const focus = svg.append('g')
        .append('circle')
        .style("fill", "none")
        .attr("stroke", "black")
        .attr('r', 8.5)
        .style("opacity", 0);

    const listeningRect = svg.append('rect')
        .attr('width', width)
        .attr('height', height)
        .style('fill', 'none')
        .style('pointer-events', 'all')
        .on('mouseover', () => { focus.style("opacity", 1); tooltip.style("opacity", 1); })
        .on('mouseout', () => { focus.style("opacity", 0); tooltip.style("opacity", 0); })
        .on('mousemove', mousemove);

    const bisectDate = d3.bisector(d => d.date).left;

    function mousemove(event) {
        const [x_coord] = d3.pointer(event);
        const x_date = xScale.invert(x_coord);
        
        // 어떤 데이터셋에 더 가까운지 판별
        const world_i = bisectDate(processedWorldData, x_date, 1);
        const wilds_i = bisectDate(processedWildsData, x_date, 1);
        
        const d_world = processedWorldData[world_i];
        const d_wilds = processedWildsData[wilds_i];
        
        let targetData, seriesName;
        
        // 더 가까운 점 찾기 (둘 다 데이터가 있을 경우)
        if (d_world && d_wilds) {
            const diff_world = Math.abs(x_date - d_world.date);
            const diff_wilds = Math.abs(x_date - d_wilds.date);
            targetData = diff_world < diff_wilds ? d_world : d_wilds;
            seriesName = diff_world < diff_wilds ? "World" : "Wilds";
        } else if (d_world) {
            targetData = d_world;
            seriesName = "World";
        } else if (d_wilds) {
            targetData = d_wilds;
            seriesName = "Wilds";
        } else {
            return;
        }

        focus.attr("cx", xScale(targetData.date))
             .attr("cy", yScale(targetData.value));
        
        tooltip.style("opacity", 1)
            .html(`<strong>${seriesName}</strong><br>
                   날짜: ${d3.timeFormat("%Y-%m-%d")(targetData.date)}<br>
                   접속자: ${targetData.value.toLocaleString()}`)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

}).catch(error => {
    console.error("데이터 로딩/처리 중 오류 발생:", error);
    d3.select("#chart-container").text("데이터를 불러오는 데 실패했습니다. CSV 파일 경로와 형식을 확인해주세요.");
});
