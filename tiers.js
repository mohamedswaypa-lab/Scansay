/* ScanSay packages. Four levels per industry group. Prices are monthly in SEK, excl. VAT, and are defaults the owner can change in the admin. */
(function(){
const LV=[{id:'s',n:'Liten|Small'},{id:'m',n:'Mellan|Medium'},{id:'l',n:'Stor|Large'},{id:'e',n:'Företag|Enterprise'}];
const FEAT={
 s:['QR-dekaler som ni skriver ut själva|QR stickers you print yourselves','Larm via e-post och SMS|Alerts by email and SMS','Inkorg och svar till kunden|Inbox and replies to the customer','Grundstatistik|Basic statistics','GDPR-verktyg och biträdesavtal|GDPR tools and data processing agreement'],
 m:['Allt i Liten|Everything in Small','Ärenden går till rätt avdelning och person|Cases go to the right department and person','Larm via SMS, Microsoft Teams eller Slack|Alerts by SMS, Microsoft Teams or Slack','Statistik per avdelning|Statistics per department','Inbjudan till offentlig recension, samma för alla kunder|Invitation to post a public review, the same for every customer'],
 l:['Allt i Mellan|Everything in Medium','Ärenden för fastighet och teknik|Maintenance and facilities tickets','Eskalering om ärenden inte bekräftas (15 och 30 min)|Escalation if tickets are not acknowledged (15 and 30 min)','Intyg varje månad|Monthly certificate (intyg)','AI-insikter varje vecka|Weekly AI insights','Välj egna sektioner|Choose your own sections'],
 e:['Allt i Stor|Everything in Large','Flera anläggningar och grupper|Multiple sites and groups','Egen profil på formulär och dekaler|Custom branding on forms and stickers','Obegränsat antal användare|Unlimited users','Prioriterad support och utbildning av personal|Priority support and staff onboarding']
};
/* group: name, unit, scope per level, default price per level, sections per level (template keys), which industries */
const G={
 hotel:{n:'Hotell|Hotels',ind:['hotel'],price:{s:2490,m:4990,l:7490,e:9990},
   scope:{s:'Rum|Rooms',m:'Rum, restaurang och frukost, parkering|Rooms, restaurant and breakfast, parking',l:'Rum, restaurang, parkering, gym, spa och avkoppling, reception, toaletter och egna sektioner|Rooms, restaurant, parking, gym, spa and relaxation, reception, toilets and your own sections',e:'Alla områden, flera hotell, egen profil|All areas, several hotels, custom branding'},
   secs:{s:['rooms'],m:['rooms','restaurant','parking'],l:['rooms','restaurant','parking','spa','reception','toilets'],e:'all'}},
 food:{n:'Restauranger och kaféer|Restaurants and cafés',ind:['restaurant','cafe'],price:{s:690,m:1290,l:1990,e:3990},
   scope:{s:'Matsal eller kafé|Dining room or café',m:'Matsal, bar och toaletter|Dining room, bar and toilets',l:'Alla ytor, uteservering, take away och egna sektioner|All areas, terrace, takeaway and your own sections',e:'Flera restauranger eller kedja|Several restaurants or a chain'},
   secs:{s:['tables'],m:['tables','bar','toilets'],l:'all',e:'all'}},
 bus:{n:'Kollektivtrafik|Public transport',ind:['bus','stop','station','ferry'],price:{s:2990,m:6990,l:12990,e:19990},
   scope:{s:'Upp till 20 fordon|Up to 20 vehicles',m:'Upp till 75 fordon och hållplatser|Up to 75 vehicles and stops',l:'Upp till 200 fordon, stationer och egna sektioner|Up to 200 vehicles, stations and your own sections',e:'Obegränsat, flera trafikområden|Unlimited, several traffic areas'},
   secs:{s:['vehicle'],m:['vehicle','stop'],l:'all',e:'all'}},
 taxi:{n:'Taxi|Taxi',ind:['taxi'],price:{s:790,m:2490,l:4990,e:8990},
   scope:{s:'Upp till 10 bilar|Up to 10 cars',m:'Upp till 50 bilar|Up to 50 cars',l:'Upp till 150 bilar och egna sektioner|Up to 150 cars and your own sections',e:'Obegränsad flotta|Unlimited fleet'},
   secs:{s:['car'],m:['car'],l:'all',e:'all'}},
 property:{n:'Fastigheter och lokaler|Property and premises',ind:['office','mall','housing','coworking','arena','parking'],price:{s:990,m:2490,l:4990,e:8990},
   scope:{s:'En byggnad, entré och toaletter|One building, entrance and toilets',m:'Upp till 3 byggnader, pentry och städning|Up to 3 buildings, kitchenettes and cleaning',l:'Upp till 10 byggnader och egna sektioner|Up to 10 buildings and your own sections',e:'Hela fastighetsbeståndet|The whole property portfolio'},
   secs:{s:['entrance','toilets'],m:'all',l:'all',e:'all'}},
 public:{n:'Offentlig sektor|Public sector',ind:['municipal','library','culture'],price:{s:1490,m:2990,l:5990,e:9990},
   scope:{s:'En enhet|One unit',m:'Upp till 3 enheter|Up to 3 units',l:'Upp till 10 enheter och egna sektioner|Up to 10 units and your own sections',e:'Hela kommunen eller regionen|The whole municipality or region'},
   secs:{s:['reception'],m:'all',l:'all',e:'all'}},
 leisure:{n:'Träning, fritid och upplevelser|Fitness, leisure and venues',ind:['gym','pool','sports','padel','golf','cinema','event','museum'],price:{s:790,m:1490,l:2490,e:4990},
   scope:{s:'Träningsytor eller salong|Training areas or hall',m:'Plus omklädningsrum och reception|Plus changing rooms and reception',l:'Alla ytor, pass, spa och egna sektioner|All areas, classes, spa and your own sections',e:'Flera anläggningar|Several sites'},
   secs:{s:['training'],m:['training','changing','reception'],l:'all',e:'all'}},
 retail:{n:'Handel och service|Retail and services',ind:['shop','grocery','fuel','workshop','salon'],price:{s:590,m:1190,l:2490,e:4990},
   scope:{s:'En butik|One store',m:'Butik, provrum och kundtjänst|Store, fitting rooms and customer service',l:'Upp till 10 butiker och egna sektioner|Up to 10 stores and your own sections',e:'Hela kedjan|The whole chain'},
   secs:{s:'first',m:'all',l:'all',e:'all'}}
};
const groupOf=ind=>Object.keys(G).find(k=>G[k].ind.includes(ind))||'retail';
const custom=lv=>lv==='l'||lv==='e';
window.SSTIERS={LV,FEAT,G,groupOf,custom};
})();
