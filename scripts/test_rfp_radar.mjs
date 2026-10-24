import test from 'node:test';
import assert from 'node:assert/strict';
import {filterRadar,renderRadarCards} from '../rfp-radar.js';

const make=(id,overrides={})=>({id,title:`Energy engineering notice ${id}`,authority:'MASEN',status:'open',fit:'Possible fit — review required',fitScore:60,serviceCategories:['Grid advisory'],technologies:['solar'],publishedAt:'2026-10-16',deadlineAt:'2026-11-17',firstDiscoveredAt:'2026-10-16T10:00:00Z',newToAtlas:true,officialUrl:`https://etendering.masen.ma/${id}`,sourceName:'MASEN',evidence:'Official notice row',eligibilityReview:['Eligibility unknown; review dossier'],...overrides});

test('empty radar displays explicit empty feed guidance',()=>{
 assert.match(renderRadarCards([]),/No qualifying notices/);assert.match(renderRadarCards([]),/coverage below/);
});
test('a large feed renders all eligible opportunities without truncation',()=>{
 const rows=Array.from({length:250},(_,i)=>make(String(i)));const html=renderRadarCards(rows);
 assert.equal((html.match(/class="rfp-card"/g)||[]).length,250);assert.match(html,/Submission deadline/);
});
test('filters by authority, status, fit, category, recent discovery and sort',()=>{
 const rows=[make('a'),make('b',{authority:'ONEE',status:'closing soon',fitScore:90,newToAtlas:false}),make('c',{status:'closed',serviceCategories:['Renewables'],newToAtlas:false})];
 assert.deepEqual(filterRadar(rows,{authority:'ONEE'}).map(x=>x.id),['b']);
 assert.deepEqual(filterRadar(rows,{status:'closing soon'}).map(x=>x.id),['b']);
 assert.deepEqual(filterRadar(rows,{relevance:'Possible fit — review required',category:'Grid advisory'}).map(x=>x.id),['b','a']);
 assert.deepEqual(filterRadar(rows,{recent:true}).map(x=>x.id),['a']);
 assert.equal(filterRadar(rows,{sort:'deadline'})[0].id,'a');
});
test('unknown deadlines and updates are clearly shown without inventing a due time',()=>{
 const html=renderRadarCards([make('x',{deadlineAt:null,status:'unclear',eligibilityReview:['Eligibility unknown']})]);
 assert.match(html,/Deadline not stated/);assert.match(html,/unclear/);assert.match(html,/Eligibility unknown/);assert.doesNotMatch(html,/00:00/);
});
test('untrusted text is escaped and official source references are retained',()=>{
 const html=renderRadarCards([make('x',{title:'<script>alert(1)</script>',sourceReferences:[{sourceName:'Official source',url:'https://example.gov.ma/notice'}]})]);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/https:\/\/example.gov.ma\/notice/);
});

