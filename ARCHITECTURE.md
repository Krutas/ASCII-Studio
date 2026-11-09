# ASCII Studio – architektūros ir funkcijų planas

Būsena: projektinis pasiūlymas, ne įgyvendinta programa. Pagrindas – web ir Android konceptas bei Codex pokalbis. Internetinė ir Android versijos leidžia nuotraukas ir vaizdo įrašus paversti spalvotu arba vienspalviu ASCII menu.

## 1. Naudotojo eiga

1. Pasirinkti paveikslėlį arba vaizdo įrašą įrenginyje; web papildomai leidžia nutempti failą.
2. Programėlė patikrina formatą, dydį ir pateikia pirmą peržiūrą.
3. Parenkamas simbolių rinkinys, tankis, spalva, kontrastas, šviesumas, sodrumas ir stiliaus šablonas.
4. Peržiūra atnaujinama po pakeitimų; video atveju galimas atkūrimas, pauzė ir pozicijos keitimas.
5. Pasirinkti eksportą, stebėti progresą, atšaukti arba išsaugoti rezultatą.

## 2. Funkcijos pagal konceptą

| Ekrano dalis | Elgsena |
| --- | --- |
| Upload Media | Failo pasirinkimas, peržiūros miniatiūra, pavadinimas, dydis, trukmė, pašalinimas; formatų klaidų rodymas. |
| Conversion Mode | Paveikslėlis arba vaizdo įrašas; režimas siūlomas pagal failą. GIF laikyti animacija, jei pasirinktas vaizdo režimas. |
| Presets | Cosmic, Classic, Matrix, Retro: kiekvienas keičia parametrų rinkinį, kurį galima redaguoti. |
| ASCII Preview | Konvertuotas kadras, jo numeris ir tinklo dydis; video valdikliai ir esama pozicija. |
| ASCII Settings | Tankis, simbolių rinkinys, RGB / pilki tonai / viena spalva, kontrastas, šviesumas, sodrumas, atkurti numatytus nustatymus. |
| Export | PNG paveikslėlis ir video formatas pagal platformos galimybes; nustatymai, progresas, atšaukimas, klaidos. |
| Gallery / Tools | Koncepte matomi navigacijos punktai: galeriją ir papildomus įrankius numatyti vėlesniam etapui, neprimesti paskyrų. |

## 3. Sąsaja ir išvaizda

Web: kairėje įkėlimas ir šablonai, centre didelė peržiūra, dešinėje nustatymai, apačioje eksportas. Siauresniame lange skydelius perkelti į vertikalų srautą. Android: viršuje navigacija, tada failas, režimas, peržiūra, nustatymai ir eksporto mygtukai; valdikliai pritaikyti lietimui.

Bendras stilius: tamsus fonas, stačiakampės panelės, monospace šriftas, violetiniai akcentai. Už sąsajos – spalvota statinė kosmoso ASCII scena. Numatyta maždaug 5 × 9 px simbolio gardelė, tačiau tankį reikia pritaikyti pagal langą ir įrenginio našumą. Vaizdas nejuda: tik simbolių šviesumo mirgėjimas ir per juos slenkanti šviesos juosta. Fonas neprivalo reaguoti į pelę. Leisti išjungti animaciją ir gerbti sumažinto judesio nustatymą; riboti atnaujinimo dažnį ir nenaudoti tūkstančių DOM elementų.

## 4. Siūloma architektūra

Rekomendacija: bendras TypeScript konvertavimo branduolys ir React web sąsaja; Android pradėti kaip tos pačios sąsajos Capacitor apvalkalą, o sudėtingam video dekodavimui / eksportui pridėti Android native modulį, kai reikės. Taip dalijamasi konvertavimo logika ir sąsaja, bet galutinės Android video galimybės priklauso nuo įrenginio ir pasirinkto native realizavimo.

Alternatyvos: atskira Kotlin Android programėlė suteikia daugiau natyvios kontrolės, bet didina darbo apimtį; serverinis konvertavimas supaprastina sunkių failų palaikymą klientuose, tačiau kainuoja ir reikalauja įkelti privačius failus. MVP siūlomas vietinis apdorojimas, be serverio, paskyros ir duomenų bazės.

Duomenų kelias: failo parinkiklis → formato patikra → dekoderis → kadro sumažinimas → ASCII branduolys → peržiūros rendereris → eksportuotojas → išsaugojimas. Sunkų darbą vykdyti Worker / atskirame vykdymo sraute; sąsaja turi išlikti reaguojanti. Perduodami tik reikalingi kadrai, nerinkti viso video į atmintį.

### Branduolio atsakomybės

- Dekoderis tiekia RGB/RGBA pikselius ir kadrų laikus; platformų adapteriai slepia naršyklės ir Android skirtumus.
- Tankis nustato stulpelių skaičių; eilučių skaičius skaičiuojamas pagal vaizdo proporciją ir šrifto simbolio plotį / aukštį.
- Mažinti vaizdą iki gardelės dydžio, pritaikyti šviesumą, kontrastą ir sodrumą, apskaičiuoti ląstelės šviesį, priskirti simbolį iš pagal šviesį surikiuoto rinkinio. Pasirinktinai invertuoti.
- RGB režimu išsaugoti ląstelės spalvą; pilkiems tonams naudoti šviesį; vienspalviam režimui – pasirinktą spalvą. Skaidrius pikselius komponuoti pasirinkto fono spalva.
- Rezultato modelis: stulpeliai, eilutės, simboliai, spalvos, fono spalva, kadro laikas ir nustatymų versija.
- Vienodas nustatymų modelis ir deterministinis konvertavimas leidžia testuoti branduolį nepriklausomai nuo sąsajos.

### Peržiūra ir eksportas

Paveikslėlius piešti Canvas pagal tą patį simbolių ir spalvų modelį; PNG eksportuoti atskiru pasirinktos raiškos canvas. Vaizdo peržiūrai konvertuoti tik reikalingus kadrus, reguliuoti kokybę ir FPS pagal našumą. Eksportui nuskaityti ir koduoti kadrus nuosekliai su laiko žymomis; vartotojui rodyti progresą ir suteikti atšaukimą.

MP4/H.264 eksportas nėra savaime garantuotas visose naršyklėse. Pirmiausia patikrinti dekoderio, kodavimo ir konteinerio palaikymą; pasiūlyti palaikomą formatą (pvz., WebM, kai palaikoma) arba aiškią klaidą. Android kodavimui įvertinti MediaCodec ir MediaMuxer. Garsą palaikyti tik tada, kai įgyvendintas ir patikrintas jo sinchronizavimas bei konteinerio suderinamumas; iki tol aiškiai žymėti, kad eksporte garso nėra. Nežadėti 500 MB ribos ar konkretaus FPS iki matavimų.

## 5. Projektų struktūra

- apps/web – React sąsaja, naršyklės failų ir medijos adapteriai.
- apps/android – Capacitor apvalkalas ir pasirenkami Android media adapteriai.
- packages/ascii-core – platformoms bendra konversija, nustatymai, šablonai.
- packages/render – gardelės piešimas, šriftų metrika ir PNG eksportas.
- packages/media – platformos sąsajos dekodavimui, kodavimui ir progresui.
- docs – naudotojo eiga, formatų ir apribojimų lentelė, architektūra.
- tests – branduolio, eksporto ir galutinių naudotojo scenarijų testai.

Ši struktūra – siūlymas, o ne dabartinių failų aprašymas.

## 6. Privatumas, ribos ir klaidos

Failai pagal numatymą lieka įrenginyje; jokių foninių įkėlimų. Naudoti sistemos failų parinkiklį, neskaityti kitų failų ir laikinus objektų URL / resursus atlaisvinti. Tikrinti failo tipą ir realų dekodavimą, saugotis pernelyg didelių matmenų, nepakankamos atminties ir užstrigusių užduočių. Nepalaikomą formatą paaiškinti prieš pradedant eksportą. Nurodyti realią įrenginio ribą; neleisti vienu metu paleisti kelių sunkių eksportų. Nustatymus galima saugoti lokaliai, failų turinį išsaugoti tik aiškiu naudotojo pasirinkimu.

## 7. Etapai ir priėmimo kriterijai

1. **Pagrindas:** sutarti nustatymų modelį ir šablonus; sukurti reaguojantį web išdėstymą ir statinį ASCII foną.
2. **Paveikslėliai:** įkelti JPG/PNG/WebP pagal palaikymą, peržiūrėti pakeitimus, eksportuoti PNG. Patikrinti proporcijas, spalvas, skaidrumą, tuščius ir sugadintus failus.
3. **Android:** parinkti failą sistemos parinkikliu, naudoti lietimui pritaikytą sąsają, išsaugoti PNG; išbandyti realiame įrenginyje.
4. **Video:** išmatuoti dekodavimo ir kodavimo palaikymą, sukurti kadro peržiūrą ir nuoseklų eksportą su progresu, atšaukimu ir tiksliai nurodytu garso palaikymu.
5. **Optimizavimas:** išbandyti didelius failus, ilgus įrašus, silpnesnius telefonus, sumažinto judesio režimą ir skirtingas naršykles. Dokumentuoti realius limitus.
6. **Vėliau:** vietinė galerija, papildomi simbolių rinkiniai, paketinis apdorojimas, pasirenkamas serverinis eksportas.

## 8. Patikra

Branduolio testai: vienodos įvesties deterministinis rezultatas, šviesio kraštinės reikšmės, proporcijos, skaidrumas ir spalvų režimai. Integraciniai testai: įkelti → pakeisti nustatymus → eksportuoti ir perskaityti PNG. Video: ilgio ir kadrų laiko tikslumas, garso politika, atšaukimas, atminties ribos bei nepalaikomi kodekai. Rankinė patikra: desktop naršyklė ir tikras Android įrenginys; klaviatūra, kontrastas, sumažintas judesys.

## 9. Atviri sprendimai

- Ar galutinė Android versija turi veikti visiškai neprisijungusi ir būti platinama per Play Store?
- Kurie video formatai, maksimali trukmė ir raiška yra būtini?
- Ar garsas būtinas pirmajame video eksporto leidime?
- Ar galerija turi saugoti projektus ir originalius failus, ar tik eksporto istoriją?
