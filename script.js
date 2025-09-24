'use strict';

/* ===== 기본 설정 ===== */
var margin = { top: 40, right: 30, bottom: 55, left: 80 };
var width  = 1200 - margin.left - margin.right;
var height = 600  - margin.top  - margin.bottom;

var svg = d3.select('#area-chart')
  .attr('width',  width  + margin.left + margin.right)
  .attr('height', height + margin.top  + margin.bottom)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

var tooltip = d3.select('body').append('div').attr('class', 'tooltip');

var COLOR = {
  wildsFill:  getComputedStyle(document.documentElement).getPropertyValue('--wilds-fill').trim() || '#E69F00',
  wildsLine:  getComputedStyle(document.documentElement).getPropertyValue('--wilds-stroke').trim() || '#955E00',
  worldFill:  getComputedStyle(document.documentElement).getPropertyValue('--world-fill').trim() || '#56B4E9',
  worldLine:  getComputedStyle(document.documentElement).getPropertyValue('--world-stroke').trim() || '#2F6E8E',
  event:      getComputedStyle(document.documentElement).getPropertyValue('--event').trim() || '#D55E00'
};

/* 데이터 경로 */
var wildsPath = 'data/wilds_data.csv';
var worldPath = 'data/world_data.csv';

/* 출시일 & 이벤트 */
var releaseDates = { world: new Date('2018-08-09'), wilds: new Date('2025-02-28') };
var events = [
  { date: '2018-09-06', label: 'PC 최적화 패치', game: 'world' },
  { date: '2020-01-09', label: '아이스본 출시',   game: 'world' }
];

/* 스케일/모드 */
var minY = 1000;
var x0 = d3.scaleLinear().range([0, width]); // 원본 x
var x  = x0.copy();                           // 현재 x(줌 반영)
var y;                                        // 현재 y(모드별)
var scaleMode = 'log';                        // 'log' | 'symlog' | 'relative'
var symlogK = 50000;                          // 심로그 상수(데이터 로드 후 동적 설정)

/* 레이어 */
var defs = svg.append('defs');
defs.append('clipPath').attr('id', 'clip')
  .append('rect').attr('width', width).attr('height', height);

var areaLayer  = svg.append('g').attr('clip-path','url(#clip)');
var lineLayer  = svg.append('g').attr('clip-path','url(#clip)');
var eventLayer = svg.append('g');
var uiLayer    = svg.append('g');

/* 축 */
var xAxisG = svg.append('g').attr('transform', 'translate(0,' + height + ')');
var yAxisG = svg.append('g');
xAxisG.append('text').attr('x', width/2).attr('y', 45).attr('fill','#000').attr('font-weight','bold')
  .attr('text-anchor','middle').text('출시 후 경과일 (Days after release)');
yAxisG.append('text').attr('transform','rotate(-90)').attr('x', -height/2).attr('y', -60)
  .attr('fill','#000').attr('font-weight','bold').attr('text-anchor','middle')
  .text('동시 접속자 수 / %');

/* 포커스 */
var focus = uiLayer.append('g').style('opacity', 0);
focus.append('line').attr('class','focus-line').attr('y1',0).attr('y2',height);
var dotWorld = focus.append('circle').attr('r',4).attr('class','focus-circle');
var dotWilds = focus.append('circle').attr('r',4).attr('class','focus-circle');
var diffLine = focus.append('line').attr('class','focus-diff');

var overlay = uiLayer.append('rect').attr('width', width).attr('height', height)
  .style('fill','none').style('pointer-events','all');

/* y값 계산 */
var maxWorld = 1, maxWilds = 1;
function yVal(series, v){
  if (scaleMode === 'relative'){
    var base = series === 'world' ? maxWorld : maxWilds;
    return Math.max(0, 100 * v / (base || 1));
  } else {
    return Math.max(0, v);
  }
}
function makeY(maxPlayers){
  if (scaleMode === 'log'){
    return d3.scaleLog().domain([minY, maxPlayers]).range([height,0]).clamp(true);
  }
  if (scaleMode === 'symlog'){
    // 동적 상수로 저부 확대
    return d3.scaleSymlog().constant(symlogK).domain([0, maxPlayers]).range([height,0]).clamp(true);
  }
  return d3.scaleLinear().domain([0,100]).range([height,0]).nice();
}
function y0Base(){ return scaleMode === 'log' ? y(minY) : y(0); }

function areaGenFor(series){
  return d3.area()
    .x(function(d){ return x(d.days); })
    .y0(function(){ return y0Base(); })
    .y1(function(d){ return y( yVal(series, d.players) ); })
    .curve(d3.curveMonotoneX);
}
function lineGenFor(series){
  return d3.line()
    .x(function(d){ return x(d.days); })
