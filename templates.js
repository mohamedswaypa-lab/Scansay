/* ScanSay industry templates: category → industry → sections → topics.
   Strings are "sv|en". Used by the signup form, the dashboard QR generator,
   the customer form and the statistics/AI summary, so every message carries
   industry, section and topic in the same structure. */
(function(){
const s=(k,n,t,ex)=>({k,n,t,ex:ex||[]});
/* shared sections */
const TOIL=s('toilets','Toaletter|Toilets',['Renlighet|Cleanliness','Papper och tvål|Paper and soap','Något är trasigt|Something broken','Lukt|Smell','Tillgänglighet|Accessibility'],['Toalett entré|Toilet entrance']);
const RECEP=s('reception','Reception|Reception',['Bemötande|Service and manner','Väntetid|Waiting time','Information|Information','Tillgänglighet|Accessibility'],['Reception|Reception']);
const PARK=s('parking','Parkering|Parking',['Lediga platser|Free spaces','Betalning|Payment','Belysning|Lighting','Trygghet|Safety','Skyltning|Signage'],['Parkering|Parking']);
const ENTR=s('entrance','Entré|Entrance',['Tillgänglighet|Accessibility','Skyltning|Signage','Öppettider|Opening hours','Trygghet|Safety'],['Huvudentré|Main entrance']);
const CHANGE=s('changing','Omklädningsrum|Changing rooms',['Renlighet|Cleanliness','Duschar|Showers','Skåp|Lockers','Temperatur|Temperature','Något är trasigt|Something broken'],['Omklädningsrum dam|Women’s changing room','Omklädningsrum herr|Men’s changing room']);
const FOOD=s('food','Mat och dryck|Food and drink',['Mat|Food','Utbud|Selection','Kö|Queue','Pris|Price','Personal|Staff'],['Kiosk|Kiosk']);

const CAT={
 transport:{n:'Transport och resor|Transport and travel',ind:{
  bus:{n:'Buss och spårvagn|Bus and tram',unit:'fordon|vehicle',sec:[
   s('vehicle','Fordon|Vehicle',['Föraren och bemötande|Driver and manner','Körning|Driving','Punktlighet|Punctuality','Städning|Cleanliness','Temperatur|Temperature','Något är trasigt|Something broken','Trygghet|Safety'],['Buss 4501|Bus 4501','Buss 4502|Bus 4502'])]},
  stop:{n:'Hållplatser|Bus stops',unit:'läge|stop position',sec:[
   s('stop','Hållplatsläge|Stop position',['Väderskydd|Shelter','Belysning|Lighting','Tidtabell och skärmar|Timetable and screens','Snö och is|Snow and ice','Tillgänglighet|Accessibility','Trygghet|Safety','Bussen stannade inte|Bus did not stop'],['Hållplats 12 läge A|Stop 12 position A','Hållplats 12 läge B|Stop 12 position B'])]},
  taxi:{n:'Taxi|Taxi',unit:'bil|car',sec:[
   s('car','Bil|Car',['Föraren och bemötande|Driver and manner','Körning|Driving','Väg och pris|Route and price','Renlighet|Cleanliness','Bokning|Booking','Betalning|Payment','Trygghet|Safety'],['Bil 112|Car 112','Bil 113|Car 113'])]},
  station:{n:'Tåg och stationer|Rail and stations',unit:'yta|area',sec:[
   s('platform','Perrong|Platform',['Information och skyltar|Information and signs','Belysning|Lighting','Snö och is|Snow and ice','Trygghet|Safety','Tillgänglighet|Accessibility'],['Spår 1|Track 1']),
   s('waiting','Väntsal|Waiting hall',['Renlighet|Cleanliness','Sittplatser|Seating','Temperatur|Temperature','Trygghet|Safety'],['Väntsal|Waiting hall']),
   s('tickets','Biljetter|Tickets',['Biljettautomat|Ticket machine','Personal|Staff','Kö|Queue'],['Biljettautomat 1|Ticket machine 1']),TOIL]},
  ferry:{n:'Färjor och båtar|Ferries and boats',unit:'fartyg|vessel',sec:[
   s('onboard','Ombord|On board',['Personal|Staff','Renlighet|Cleanliness','Sittplatser|Seating','Punktlighet|Punctuality','Trygghet|Safety'],['Däck 1|Deck 1']),
   s('terminal','Terminal|Terminal',['Information|Information','Väntetid|Waiting time','Tillgänglighet|Accessibility'],['Terminal|Terminal']),
   s('cafe','Kafé ombord|Café on board',['Utbud|Selection','Kö|Queue','Pris|Price'],['Kafé|Café']),TOIL]},
  parking:{n:'Parkering|Parking',unit:'område|area',sec:[
   s('lot','Parkeringsplats|Car park',['Lediga platser|Free spaces','Betalning|Payment','Belysning|Lighting','Trygghet|Safety','Skyltning|Signage','Något är trasigt|Something broken'],['Plan 1|Level 1']),
   s('charging','Laddplatser|Charging',['Laddaren fungerar|Charger works','Betalning|Payment','Lediga platser|Free spaces'],['Laddplats 1|Charger 1'])]}
 }},
 property:{n:'Fastigheter och lokaler|Property and premises',ind:{
  office:{n:'Kontor|Offices',unit:'rum|room',sec:[
   s('floor','Våning och rum|Floor and room',['Inomhusklimat|Indoor climate','Städning|Cleaning','Belysning|Lighting','Ljud|Noise','Något är trasigt|Something broken'],['Våning 3|Floor 3']),
   s('meeting','Mötesrum|Meeting rooms',['Teknik och skärm|Tech and screen','Bokning|Booking','Städning|Cleaning','Inomhusklimat|Indoor climate'],['Mötesrum Ek|Meeting room Oak']),
   s('kitchen','Pentry och kök|Kitchen',['Städning|Cleaning','Kaffemaskin|Coffee machine','Kylskåp|Fridge','Diskmaskin|Dishwasher'],['Pentry plan 3|Kitchen floor 3']),
   TOIL,s('entrance','Entré|Entrance',['Passage och dörrar|Access and doors','Reception|Reception','Trygghet|Safety'],['Entré|Entrance'])]},
  mall:{n:'Köpcentrum|Shopping centres',unit:'yta|area',sec:[
   s('walkways','Gångar och torg|Walkways and squares',['Renlighet|Cleanliness','Skyltning|Signage','Trygghet|Safety','Sittplatser|Seating'],['Torget|The square']),
   s('info','Information|Information desk',['Personal|Staff','Öppettider|Opening hours','Hitta rätt|Finding the way'],['Informationsdisk|Information desk']),TOIL,PARK]},
  housing:{n:'Bostadshus|Housing',unit:'utrymme|space',sec:[
   s('stairwell','Trapphus|Stairwell',['Städning|Cleaning','Belysning|Lighting','Hiss|Lift','Dörrar och lås|Doors and locks'],['Trapphus A|Stairwell A']),
   s('laundry','Tvättstuga|Laundry room',['Maskiner|Machines','Bokning|Booking','Städning|Cleaning'],['Tvättstuga|Laundry room']),
   s('waste','Soprum|Waste room',['Städning|Cleaning','Sortering|Sorting','Fullt|Full'],['Soprum|Waste room']),
   s('yard','Gård|Courtyard',['Skötsel|Upkeep','Belysning|Lighting','Lekplats|Playground','Trygghet|Safety'],['Gården|Courtyard'])]},
  coworking:{n:'Coworking|Coworking',unit:'yta|area',sec:[
   s('desks','Arbetsplatser|Workspaces',['Lediga platser|Free desks','Wi-Fi|Wi-Fi','Ljud|Noise','Inomhusklimat|Indoor climate'],['Öppna ytan|Open area']),
   s('meeting','Mötesrum|Meeting rooms',['Teknik och skärm|Tech and screen','Bokning|Booking','Städning|Cleaning'],['Mötesrum 1|Meeting room 1']),
   s('kitchen','Kök|Kitchen',['Städning|Cleaning','Kaffe|Coffee','Utrustning|Equipment'],['Köket|Kitchen']),TOIL]},
  arena:{n:'Arenor och mässor|Arenas and venues',unit:'yta|area',sec:[
   s('seats','Läktare och sittplatser|Stands and seats',['Sikt|View','Stolar|Seats','Renlighet|Cleanliness','Trygghet|Safety'],['Sektion A|Section A']),
   FOOD,s('gates','Entré och kö|Gates and queues',['Kö|Queue','Personal|Staff','Skyltning|Signage','Trygghet|Safety'],['Port 1|Gate 1']),TOIL]}
 }},
 hospitality:{n:'Hotell, mat och nöje|Hotels, food and entertainment',ind:{
  hotel:{n:'Hotell|Hotels',unit:'rum|room',sec:[
   s('rooms','Rum|Rooms',['Städning|Cleaning','Säng och sömn|Bed and sleep','Ljud|Noise','Temperatur|Temperature','Badrum|Bathroom','Wi-Fi och TV|Wi-Fi and TV','Något är trasigt|Something broken'],['Rum 101|Room 101','Rum 102|Room 102']),
   s('reception','Reception|Reception',['Bemötande|Service and manner','Incheckning|Check-in','Väntetid|Waiting time','Information|Information'],['Reception|Reception']),
   s('restaurant','Restaurang och frukost|Restaurant and breakfast',['Mat|Food','Utbud|Selection','Väntetid|Waiting time','Renlighet|Cleanliness','Personal|Staff'],['Frukostmatsal|Breakfast room']),
   TOIL,s('spa','Spa och gym|Spa and gym',['Renlighet|Cleanliness','Utrustning|Equipment','Trängsel|Crowding','Temperatur|Temperature'],['Spa|Spa']),PARK]},
  restaurant:{n:'Restauranger|Restaurants',unit:'bord|table',sec:[
   s('tables','Bord|Tables',['Mat|Food','Service|Service','Väntetid|Waiting time','Pris|Price','Renlighet|Cleanliness','Meny och innehåll|Menu and ingredients'],['Bord 1|Table 1','Bord 2|Table 2']),
   s('bar','Bar och disk|Bar and counter',['Dryck|Drinks','Service|Service','Kö|Queue'],['Baren|The bar']),
   s('terrace','Uteservering|Terrace',['Mat|Food','Service|Service','Värme och väder|Heat and weather','Renlighet|Cleanliness'],['Uteservering|Terrace']),TOIL]},
  cafe:{n:'Kaféer|Cafés',unit:'yta|area',sec:[
   s('counter','Disk och kassa|Counter and till',['Kaffe|Coffee','Bakverk och mat|Pastries and food','Kö|Queue','Personal|Staff','Pris|Price'],['Disken|Counter']),
   s('seating','Sittplatser|Seating',['Renlighet|Cleanliness','Lediga platser|Free seats','Ljud|Noise','Wi-Fi|Wi-Fi'],['Sittplatser|Seating']),TOIL]},
  cinema:{n:'Bio|Cinemas',unit:'salong|screen',sec:[
   s('screen','Salong|Screen',['Ljud och bild|Sound and picture','Stolar|Seats','Renlighet|Cleanliness','Temperatur|Temperature','Störande besökare|Disturbing visitors'],['Salong 1|Screen 1']),
   s('kiosk','Kiosk|Kiosk',['Utbud|Selection','Kö|Queue','Personal|Staff','Pris|Price'],['Kiosken|Kiosk']),
   s('tickets','Entré och biljetter|Entrance and tickets',['Biljetter|Tickets','Kö|Queue','Personal|Staff'],['Entré|Entrance']),TOIL]},
  event:{n:'Evenemang|Events',unit:'yta|area',sec:[
   s('stage','Scen och program|Stage and programme',['Programmet|Programme','Ljud|Sound','Sikt|View','Tider|Timing'],['Stora scenen|Main stage']),
   FOOD,s('gates','Entré och kö|Gates and queues',['Kö|Queue','Personal|Staff','Trygghet|Safety'],['Entré|Entrance']),TOIL]},
  museum:{n:'Museer|Museums',unit:'sal|room',sec:[
   s('exhibit','Utställning|Exhibition',['Innehåll|Content','Skyltar och texter|Signs and texts','Tillgänglighet|Accessibility','Trängsel|Crowding'],['Sal 1|Room 1']),
   s('tickets','Entré och kassa|Entrance and tickets',['Kö|Queue','Personal|Staff','Pris|Price'],['Kassa|Ticket desk']),
   s('shop','Butik och kafé|Shop and café',['Utbud|Selection','Personal|Staff','Pris|Price'],['Butiken|Shop']),TOIL]}
 }},
 public:{n:'Offentlig sektor|Public sector',ind:{
  municipal:{n:'Kommun- och regionkontor|Municipal and regional offices',unit:'disk|desk',sec:[
   s('service','Reception och kontaktcenter|Reception and service centre',['Väntetid|Waiting time','Bemötande|Service and manner','Information|Information','Tillgänglighet|Accessibility'],['Kontaktcenter|Service centre']),
   s('waiting','Väntrum|Waiting room',['Renlighet|Cleanliness','Sittplatser|Seating','Tillgänglighet|Accessibility'],['Väntrum|Waiting room']),TOIL,ENTR]},
  library:{n:'Bibliotek|Libraries',unit:'yta|area',sec:[
   s('desk','Informationsdisk|Help desk',['Personal|Staff','Lån och återlämning|Loans and returns','Information|Information'],['Informationsdisken|Help desk']),
   s('study','Studieplatser|Study spaces',['Ljud|Noise','Lediga platser|Free seats','El och Wi-Fi|Power and Wi-Fi','Belysning|Lighting'],['Läsesalen|Reading room']),
   s('computers','Datorer och skrivare|Computers and printers',['Fungerar|Working','Bokning|Booking','Utskrift|Printing'],['Datorplatser|Computers']),
   s('kids','Barnavdelning|Children’s section',['Utbud|Selection','Renlighet|Cleanliness','Ljud|Noise'],['Barnavdelningen|Children’s section']),TOIL]},
  culture:{n:'Kulturhus|Culture houses',unit:'yta|area',sec:[
   s('programme','Program och evenemang|Programme and events',['Innehåll|Content','Tider|Timing','Information|Information'],['Stora salen|Main hall']),
   s('premises','Lokaler|Premises',['Renlighet|Cleanliness','Tillgänglighet|Accessibility','Ljud|Noise'],['Foajén|Foyer']),RECEP,TOIL]}
 }},
 leisure:{n:'Träning och fritid|Fitness and leisure',ind:{
  gym:{n:'Gym|Gyms',unit:'zon|area',sec:[
   s('training','Träningsytor|Training areas',['Trasig utrustning|Broken equipment','Trängsel|Crowding','Renlighet|Cleanliness','Musik och luft|Music and air'],['Konditionsytan|Cardio area','Vikter|Weights']),
   CHANGE,s('classes','Pass och instruktörer|Classes and instructors',['Instruktör|Instructor','Innehåll|Content','Bokning|Booking'],['Passalen|Studio']),
   s('reception','Reception|Reception',['Bemötande|Service and manner','Medlemskap|Membership','Information|Information'],['Reception|Reception'])]},
  pool:{n:'Simhallar|Swimming pools',unit:'yta|area',sec:[
   s('pool','Bassäng|Pool',['Vattentemperatur|Water temperature','Renlighet|Cleanliness','Trängsel|Crowding','Trygghet och badvakter|Safety and lifeguards'],['Stora bassängen|Main pool']),
   CHANGE,s('tickets','Kassa och entré|Tickets and entrance',['Kö|Queue','Personal|Staff','Pris|Price'],['Kassan|Ticket desk']),
   s('cafe','Kafé|Café',['Utbud|Selection','Kö|Queue','Pris|Price'],['Kaféet|Café'])]},
  sports:{n:'Sporthallar|Sports halls',unit:'hall|hall',sec:[
   s('hall','Hall och banor|Hall and courts',['Underlag|Surface','Utrustning|Equipment','Bokning|Booking','Renlighet|Cleanliness'],['Hall A|Hall A']),
   CHANGE,s('stands','Läktare|Stands',['Sittplatser|Seating','Renlighet|Cleanliness','Trygghet|Safety'],['Läktaren|Stands']),TOIL]},
  padel:{n:'Padel och tennis|Padel and tennis',unit:'bana|court',sec:[
   s('courts','Banor|Courts',['Underlag|Surface','Belysning|Lighting','Nät och glas|Net and glass','Bokning|Booking'],['Bana 1|Court 1','Bana 2|Court 2']),
   CHANGE,s('reception','Reception och shop|Reception and shop',['Personal|Staff','Hyra av utrustning|Equipment rental','Pris|Price'],['Receptionen|Reception'])]},
  golf:{n:'Golfklubbar|Golf clubs',unit:'yta|area',sec:[
   s('course','Banan|The course',['Greener|Greens','Fairways|Fairways','Skyltning|Signage','Spelfart|Pace of play'],['Hål 1|Hole 1']),
   s('clubhouse','Klubbhus|Clubhouse',['Personal|Staff','Restaurang|Restaurant','Shop|Shop'],['Klubbhuset|Clubhouse']),
   s('range','Drivingrange|Driving range',['Bollar|Balls','Utslagsplatser|Bays','Automat|Machine'],['Rangen|Range']),TOIL]}
 }},
 retail:{n:'Handel och service|Retail and services',ind:{
  shop:{n:'Butiker|Shops',unit:'avdelning|department',sec:[
   s('checkout','Kassa|Checkout',['Kö|Queue','Personal|Staff','Betalning|Payment'],['Kassa 1|Till 1']),
   s('store','Butiken|The store',['Sortiment|Range','Prismärkning|Price labels','Renlighet|Cleanliness','Hitta rätt|Finding things'],['Butiken|Store']),
   s('fitting','Provrum|Fitting rooms',['Renlighet|Cleanliness','Kö|Queue','Speglar och belysning|Mirrors and lighting'],['Provrummen|Fitting rooms']),
   s('service','Kundtjänst|Customer service',['Retur och byte|Returns and exchange','Bemötande|Service and manner'],['Kundtjänst|Customer service'])]},
  grocery:{n:'Livsmedel|Grocery',unit:'avdelning|department',sec:[
   s('checkout','Kassa|Checkout',['Kö|Queue','Personal|Staff','Självscanning|Self-scan'],['Kassorna|Tills']),
   s('aisles','Avdelningar|Aisles',['Färskvaror|Fresh produce','Slut i hyllan|Out of stock','Prismärkning|Price labels','Renlighet|Cleanliness'],['Frukt och grönt|Fruit and veg']),
   s('deli','Deli och bageri|Deli and bakery',['Utbud|Selection','Kö|Queue','Personal|Staff'],['Delin|Deli']),PARK]},
  fuel:{n:'Bensinstationer|Petrol stations',unit:'yta|area',sec:[
   s('pumps','Pumpar och laddare|Pumps and chargers',['Fungerar|Working','Betalning|Payment','Renlighet|Cleanliness'],['Pump 1|Pump 1']),
   s('shop','Butik och kassa|Shop and till',['Kö|Queue','Personal|Staff','Utbud|Selection'],['Butiken|Shop']),
   s('wash','Biltvätt|Car wash',['Resultat|Result','Betalning|Payment','Något är trasigt|Something broken'],['Tvätten|Car wash']),TOIL]},
  workshop:{n:'Bilverkstäder|Car workshops',unit:'yta|area',sec:[
   s('work','Verkstad|Workshop',['Arbetets kvalitet|Quality of work','Tid och leverans|Time and delivery','Pris|Price','Information|Information'],['Verkstaden|Workshop']),
   s('reception','Reception|Reception',['Bemötande|Service and manner','Bokning|Booking','Väntetid|Waiting time'],['Receptionen|Reception']),
   s('waiting','Väntrum|Waiting room',['Renlighet|Cleanliness','Kaffe och Wi-Fi|Coffee and Wi-Fi'],['Väntrummet|Waiting room'])]},
  salon:{n:'Frisörer och salonger|Hair and beauty salons',unit:'plats|chair',sec:[
   s('treatment','Behandling|Treatment',['Resultat|Result','Tid|Time','Pris|Price','Rådgivning|Advice'],['Stol 1|Chair 1']),
   s('salon','Salongen|The salon',['Renlighet|Cleanliness','Bokning|Booking','Väntetid|Waiting time','Bemötande|Service and manner'],['Salongen|Salon'])]}
 }}
};
const QK={rooms:'Var rummet rent när du kom?|Was the room clean when you arrived?',toilets:'Fanns papper och tvål?|Was there paper and soap?',
 reception:'Fick du hjälp snabbt?|Did you get help quickly?',service:'Fick du hjälp snabbt?|Did you get help quickly?',desk:'Fick du hjälp snabbt?|Did you get help quickly?',info:'Fick du hjälp snabbt?|Did you get help quickly?',
 restaurant:'Fick du det du beställde i tid?|Did you get your order on time?',tables:'Fick du det du beställde i tid?|Did you get your order on time?',terrace:'Fick du det du beställde i tid?|Did you get your order on time?',bar:'Fick du det du beställde i tid?|Did you get your order on time?',food:'Fick du det du beställde i tid?|Did you get your order on time?',counter:'Fick du det du beställde i tid?|Did you get your order on time?',kiosk:'Fick du det du beställde i tid?|Did you get your order on time?',cafe:'Fick du det du beställde i tid?|Did you get your order on time?',deli:'Fick du hjälp snabbt?|Did you get help quickly?',
 vehicle:'Kändes resan trygg?|Did the trip feel safe?',onboard:'Kändes resan trygg?|Did the trip feel safe?',car:'Stämde priset med det du fick veta?|Was the price as expected?',
 stop:'Fungerade belysning och skärmar?|Were the lights and screens working?',platform:'Fungerade belysning och skärmar?|Were the lights and screens working?',
 training:'Fungerade utrustningen?|Was the equipment working?',hall:'Fungerade utrustningen?|Was the equipment working?',courts:'Var banan i bra skick?|Was the court in good condition?',pumps:'Fungerade pumpen?|Was the pump working?',computers:'Fungerade datorn?|Was the computer working?',charging:'Fungerade laddaren?|Was the charger working?',
 meeting:'Fungerade tekniken?|Did the tech work?',kitchen:'Var köket rent?|Was the kitchen clean?',classes:'Var passet bra?|Was the class good?',
 checkout:'Gick det snabbt i kön?|Was the queue quick?',tickets:'Gick det snabbt i kön?|Was the queue quick?',gates:'Gick det snabbt i kön?|Was the queue quick?',
 pool:'Kändes det tryggt i bassängen?|Did the pool feel safe?',work:'Blev arbetet klart i tid?|Was the work done on time?',treatment:'Blev du nöjd med resultatet?|Were you happy with the result?'};
const QUICK=k=>QK[k]||'Var det rent och i ordning?|Was it clean and in order?';
const flat={};Object.entries(CAT).forEach(([ck,c])=>Object.entries(c.ind).forEach(([ik,i])=>{flat[ik]=Object.assign({cat:ck},i)}));
const tr=(x,l)=>{const p=String(x).split('|');return l==='en'?(p[1]||p[0]):p[0]};
const SEC=(ind,k)=>{const i=flat[ind];return i&&i.sec.find(x=>x.k===k)};
window.SSTPL={CAT,IND:flat,tr,SEC,QUICK};
})();
