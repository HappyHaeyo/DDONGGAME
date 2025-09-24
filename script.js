'use strict';

// --------- 기본 설정 ---------
var margin = { top: 40, right: 30, bottom: 55, left: 80 };
var width  = 1200 - margin.left - margin.right;
var height = 600  - margin.top  - margin.bottom;

var svg = d3.select('#area-chart')
  .attr('width',  width  + margin.left + margin.right)
  .attr('height', height + margin.top  + margin.bottom)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

var tooltip = d3.select('body').append('div').attr('class', 'tooltip');

// 데이터 경로
var wildsPath = 'data/wilds_data.csv';
var worldPath = 'data/world_data.csv';

// 출시일 (이벤트 day 계산용)
var releaseDates = {
  world: new Date('2018-08-09'),
  wilds: new Date('2025-02-28')
};

// 이벤트 (원하면 더 추가)
var events = [
  { date: '2018-09-06', label: 'PC 최적화 패치', game: 'world' },
  { date: '2020-01-09', label: '아이스본 출시',   game: 'world' }
  // { date: '2025-05-10', label: '대형 업데이트', game: 'wilds' }
];

// 로그축 하한 (필요시 10000 등으로 조정)
var minY = 1000;

// 전역 스케일(원본)
var x0 = d3.scaleLinear().range([0, width]);
var y  = d3.scaleLog().range([height, 0]).clamp(true);

// 현재 적용 스케일(줌/팬 반영본)
var x = x0.copy();

// path/axis를 묶어두는 레이어
var defs = svg.append('defs');
defs.append('clipPath').attr('id', 'clip')
  .append('rect').attr('width', width).attr('height', height);

var areaLayer = svg.append('g').attr('clip-path', 'url(#clip)');
var lineLayer = svg.append('g').attr('clip-path', 'url(#clip)');
var eventLayer= svg.append('g'); // 라인/아이콘/라벨은 영역 위에
var uiLayer   = svg.append('g'); // focus/overlay

// 포커스(툴팁)
var focus = uiLayer.append('g').style('opacity', 0);
focus.append('line').attr('class', 'focus-line').attr('y1', 0).attr('y2', height);
var dotWorld = focus.append('circle').attr('r', 4).attr('class', 'focus-circle');
var dotWilds = focus.append('circle').attr('r', 4).attr('class', 'focus-circle');

// 마우스 리스닝 + 줌/팬
var overlay = uiLayer.append('rect')
  .attr('width', width).attr('height', height)
  .style('fill', 'none').style('pointer-events', 'all');

// 축
var xAxisG = svg.append('g').attr('transform', 'translate(0,' + height + ')');
var yAxisG = svg.append('g');

// 축 라벨
xAxisG.append('text')
  .attr('x', width/2).attr('y', 45)
  .attr('fill','#000').attr('font-weight','bold').attr('text-anchor','middle')
  .text('출시 후 경과일 (Days after release)');
yAxisG.append('text')
  .attr('transform','rotate(-90)')
  .attr('x', -height/2).attr('y', -60)
  .attr('fill','#000').attr('font-weight','bold').attr('text-anchor','middle')
  .text('동시 접속자 수 (로그 스케일)');

// 도형 생성기
function ySafe(v){ return y(Math.max(minY, v)); }

var areaGen = d3.area()
  .x(function(d){ return x(d.days); })
  .y0(function(){ return y(minY); })
  .y1(function(d){ return ySafe(d.players); })
  .curve(d3.curveMonotoneX);

var lineGen = d3.line()
  .x(function(d){ return x(d.days); })
  .y(function(d){ return ySafe(d.players); })
  .curve(d3.curveMonotoneX);

// 데이터 로드
Promise.all([ d3.csv(wildsPath), d3.csv(worldPath) ]).then(function(res){
  var wilds = res[0].map(function(d){ return { days:+d.days, players:+d.players }; })
                   .filter(function(d){ return isFinite(d.days) && isFinite(d.players); })
                   .sort(function(a,b){ return a.days - b.days; });
  var world = res[1].map(function(d){ return { days:+d.days, players:+d.players }; })
                   .filter(function(d){ return isFinite(d.days) && isFinite(d.players); })
                   .sort(function(a,b){ return a.days - b.days; });

  // 도메인
  var maxDays = Math.max(
    d3.max(wilds, function(d){ return d.days; }) || 0,
    d3.max(world, function(d){ return d.days; }) || 0
  );
  var maxPlayers = Math.max(
    d3.max(wilds, function(d){ return d.players; }) || 1,
    d3.max(world, function(d){ return d.players; }) || 1
  );

  x0.domain([0, maxDays]);
  x.domain(x0.domain());
  y.domain([minY, maxPlayers]);

  // 초기 요소 생성 (경로는 바인딩만)
  var wildsArea = areaLayer.append('path').datum(wilds)
    .attr('fill', '#d95f02').attr('opacity', .65);
  var wildsLine = lineLayer.append('path').datum(wilds)
    .attr('fill', 'none').attr('stroke', '#9a3f00').attr('stroke-width', 1.5);

  var worldArea = areaLayer.append('path').datum(world)
    .attr('fill', '#405d7b').attr('opacity', .7);
  var worldLine = lineLayer.append('path').datum(world)
    .attr('fill', 'none').attr('stroke', '#2c3e50').attr('stroke-width', 1.6);

  // 이벤트 그룹 생성
  var eventG = eventLayer.selectAll('.ev').data(events.filter(function(ev){
    var dday = dayFromRelease(ev.date, ev.game);
    return dday >= 0 && dday <= maxDays;
  })).enter().append('g').attr('class','ev');

  // 수직선
  eventG.append('line')
    .attr('class', 'event-line')
    .attr('y1', 0).attr('y2', height);

  // 아이콘 (다이아몬드)
  eventG.append('path')
    .attr('class', 'event-symbol')
    .attr('d', d3.symbol().type(d3.symbolDiamond).size(70));

  // 라벨: 배경 rect + 외곽선 텍스트(얇은 하얀 stroke) + 본문 텍스트(앞쪽)
  eventG.append('rect').attr('class','event-label-bg');
  eventG.append('text').attr('class','event-label').attr('dy', '0.35em');            // 외곽선
  eventG.append('text').attr('class','event-label-foreground').attr('dy', '0.35em'); // 본문

  // 축 그리기 + 경로 업데이트 + 이벤트 위치 업데이트
  render();

  // 포인터/툴팁
  var bisect = d3.bisector(function(d){ return d.days; }).left;

  overlay
    .on('mouseover', function(){ focus.style('opacity',1); tooltip.style('opacity',1); })
    .on('mouseout',  function(){ focus.style('opacity',0); tooltip.style('opacity',0); })
    .on('mousemove', function(event){
      var mouseX = d3.pointer(event)[0];
      var dayX   = x.invert(mouseX);

      function pick(arr){
        if (!arr.length) return null;
        var i = Math.max(1, Math.min(arr.length - 1, bisect(arr, dayX)));
        var a0 = arr[i-1], a1 = arr[i];
        if (!a0 || !a1) return a0 || a1;
        return (dayX - a0.days) < (a1.days - dayX) ? a0 : a1;
      }

      var pw = pick(world);
      var pz = pick(wilds);
      if (!pw && !pz) return;

      var anchor = pw && pz ? (Math.abs(pw.days - dayX) <= Math.abs(pz.days - dayX) ? pw.days : pz.days)
                            : (pw ? pw.days : pz.days);

      focus.attr('transform', 'translate(' + x(anchor) + ',0)');
      if (pw) { dotWorld.style('opacity',1).attr('cy', ySafe(pw.players)); } else { dotWorld.style('opacity',0); }
      if (pz) { dotWilds.style('opacity',1).attr('cy', ySafe(pz.players)); } else { dotWilds.style('opacity',0); }

      var html = '<strong>Day ' + anchor + '</strong><br/>' +
                 '<span style="color:#405d7b">World:</span> ' + (pw ? pw.players.toLocaleString() : 'N/A') + '<br/>' +
                 '<span style="color:#d95f02">Wilds:</span> ' + (pz ? pz.players.toLocaleString() : 'N/A');
      tooltip.html(html)
        .style('left', (event.pageX + 14) + 'px')
        .style('top',  (event.pageY - 28) + 'px');
    });

  // --------- 줌/팬 ----------
  var zoom = d3.zoom()
    .scaleExtent([1, 20])
    .translateExtent([[0,0],[width,height]])
    .extent([[0,0],[width,height]])
    .on('zoom', function(event){
      x = event.transform.rescaleX(x0);
      render();
    });

  // 더블클릭 리셋
  overlay.on('dblclick', function(){
    svg.transition().duration(250);
    d3.select('#area-chart').transition().duration(0); // no-op
    overlay.transition().duration(0);
    x = x0.copy();
    svg.call(zoom.transform, d3.zoomIdentity);
    render();
  });

  svg.call(zoom);

  // --------- 렌더 함수 ----------
  function render(){
    // 축
    xAxisG.call(d3.axisBottom(x));
    yAxisG.call(d3.axisLeft(y).ticks(6, function(d){
      return d >= 1000000 ? (d/1000000) + 'M' : (d/1000) + 'k';
    }));

    // 경로
    wildsArea.attr('d', areaGen);
    wildsLine.attr('d', lineGen);
    worldArea.attr('d', areaGen);
    worldLine.attr('d', lineGen);

    // 이벤트 위치/라벨
    eventG.attr('transform', function(ev){
      var dday = dayFromRelease(ev.date, ev.game);
      var tx = x(dday);
      return 'translate(' + tx + ',0)';
    });

    // 수직선
    eventG.select('line.event-line').attr('y1', 0).attr('y2', height);

    // 아이콘은 차트 상단에 조금 여백 두고 배치
    eventG.select('path.event-symbol')
      .attr('transform', 'translate(0,12)');

    // 라벨: 아이콘 오른쪽에 배치
    eventG.each(function(ev){
      var g = d3.select(this);
      var padding = 4;
      var xoff = 8;    // 수직선에서 오른쪽으로
      var yoff = 12;   // 상단에서 약간 아래

      // 외곽선 텍스트와 본문 텍스트 같은 위치에 두 번 그리기
      g.select('text.event-label')
        .attr('x', xoff).attr('y', yoff)
        .text(ev.label);
      g.select('text.event-label-foreground')
        .attr('x', xoff).attr('y', yoff)
        .text(ev.label);

      // bbox로 배경 rect 크기 계산
      var bbox = g.select('text.event-label-foreground').node().getBBox();
      g.select('rect.event-label-bg')
        .attr('x', bbox.x - padding)
        .attr('y', bbox.y - padding)
        .attr('width',  bbox.width  + padding*2)
        .attr('height', bbox.height + padding*2);
    });
  }

  // 유틸: 날짜 → day
  function dayFromRelease(iso, game){
    var t = (new Date(iso) - releaseDates[game]) / (1000*60*60*24);
    return Math.floor(t);
  }

}).catch(function(err){
  console.error('load error:', err);
});
