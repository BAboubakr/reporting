export const monitoring = {
  lookbackDays: 14,
  maxItems: 80,
  marketQueries: [
    'Morocco renewable energy solar PV BESS battery wind hydrogen grid tender',
    'Morocco MASEN renewable tender project',
    'Morocco ONEE grid transmission renewable tender',
    'Morocco ANRE electricity regulation renewable',
    'Morocco green hydrogen ammonia PtX investment',
    'Morocco renewable energy manufacturing investment'
  ],
  competitorQueries: [
    'AFRY Morocco renewable energy','Artelia Morocco renewable energy','Tractebel Morocco energy renewable hydrogen',
    'Mott MacDonald Morocco energy renewable','WSP Morocco energy renewable','Worley Morocco hydrogen OCP energy',
    'Egis Morocco energy renewable','ILF Consulting Engineers Morocco hydrogen energy','DNV Morocco renewable energy grid hydrogen',
    'NOVEC Morocco energy renewable grid hydro','INGEMA Morocco energy engineering renewable',
    'JESA Morocco renewable energy solar OCP','JESA Morocco engineering energy infrastructure','JESA OCP solar project'
  ],
  officialPages: [
    {name:'ONEE tenders',url:'https://www.one.org.ma/FR/pages/aoselect.asp?action=1&domaine=&esp=2&id1=7&id2=64&id3=54&nao=&nature=&objet=&page=1&t1=&t2=&t3=1&type=',type:'official-tender'},
    {name:'ONEE tender results',url:'https://www.one.org.ma/fr/pages/result.asp?esp=2&id1=7&id2=64&id3=56&page=1&t2=1&t3=1',type:'official-result'},
    {name:'MASEN e-Tendering',url:'https://etendering.masen.ma/',type:'official-procurement'}
  ]
};
