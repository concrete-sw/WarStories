// Name pools and hometowns by nationality. Rank-and-file soldiers are named by
// code from these pools so the generated scenario stays small; the AI writes
// only the leaders and a handful of notable soldiers.

const P = s => s.split(',').map(x => x.trim()).filter(Boolean);

export const NAMES = {
  us: {
    first: P('James,John,Robert,William,Charles,George,Joseph,Frank,Edward,Walter,Harold,Raymond,Richard,Thomas,Henry,Arthur,Albert,Eugene,Leonard,Stanley,Howard,Carl,Paul,Ralph,Louis,Earl,Clarence,Roy,Floyd,Vernon,Ernest,Lloyd,Melvin,Dale,Wendell,Tony,Sal,Manuel,Jesus,Ruben,Isaac,Abe,Morris,Irving,Leroy,Otis,Clyde,Homer,Marvin,Dewey'),
    firstModern: P('Michael,David,James,Robert,Chris,Daniel,Matthew,Anthony,Jose,Luis,Carlos,Tyler,Brandon,Justin,Kevin,Jason,Ryan,Eric,Derrick,Marcus,Andre,Terrell,Darnell,Jamal,Trevor,Cody,Travis,Kyle,Ethan,Nathan,Austin,Miguel,Hector,Victor,Duc,Tuan,Kenji,Raj,Samuel,Aaron'),
    last: P('Smith,Johnson,Miller,Davis,Wilson,Anderson,Taylor,Thomas,Moore,Martin,Jackson,Thompson,White,Harris,Clark,Lewis,Walker,Hall,Allen,Young,King,Wright,Scott,Green,Baker,Adams,Nelson,Hill,Campbell,Mitchell,Roberts,Carter,Phillips,Evans,Turner,Parker,Collins,Edwards,Stewart,Morris,Murphy,Cook,Rogers,Morgan,Cooper,Peterson,Reed,Bailey,Kelly,Howard,Kowalski,Novak,Wisniewski,Zielinski,Kaminski,Rossi,Esposito,Romano,Moretti,Caruso,DeLuca,Russo,Schultz,Hoffman,Becker,Kruger,Weber,Fischer,O\'Brien,Sullivan,Doyle,Gallagher,Flanagan,Reilly,Garcia,Martinez,Rodriguez,Hernandez,Lopez,Gonzalez,Sanchez,Ramirez,Reyes,Morales,Cohen,Levine,Goldberg,Katz,Washington,Jefferson,Brooks,Coleman,Bryant,Kealoha,Yazzie,Begay,Olson,Larsen,Lindqvist,Hayes,Dunn,McCoy'),
    towns: P('Altoona PA,Scranton PA,Pittsburgh PA,Buffalo NY,Brooklyn NY,Troy NY,Hartford CT,Worcester MA,South Boston MA,Providence RI,Baltimore MD,Wheeling WV,Richmond VA,Durham NC,Macon GA,Mobile AL,Jackson MS,Shreveport LA,Little Rock AR,Memphis TN,Knoxville TN,Lexington KY,Toledo OH,Akron OH,Dayton OH,Gary IN,Fort Wayne IN,Chicago IL,Peoria IL,Detroit MI,Flint MI,Milwaukee WI,Duluth MN,Fargo ND,Sioux Falls SD,Omaha NE,Wichita KS,Tulsa OK,Amarillo TX,San Antonio TX,El Paso TX,Albuquerque NM,Gallup NM,Tucson AZ,Butte MT,Boise ID,Spokane WA,Tacoma WA,Portland OR,Fresno CA,Bakersfield CA,East Los Angeles CA,Oakland CA,Hilo HI,Salt Lake City UT,Cheyenne WY,Des Moines IA,Cedar Rapids IA,St. Louis MO,Joplin MO')
  },
  brit: {
    first: P('Albert,Alfred,Arthur,Bernard,Charles,Cyril,Dennis,Donald,Douglas,Edward,Eric,Ernest,Frank,Frederick,George,Gordon,Harold,Harry,Herbert,Jack,James,John,Kenneth,Leslie,Norman,Percy,Reginald,Ronald,Sidney,Stanley,Thomas,Walter,William,Hugh,Ian,Angus,Dai,Gareth,Owen,Seamus'),
    firstModern: P('Gary,Steve,Mark,Paul,Ian,Kevin,Lee,Darren,Craig,Wayne,Dean,Jamie,Ross,Scott,Callum,Liam,Ryan,Danny,Rob,Tom,Josh,Harry,Ollie,Ben,Dan,Rhys,Gethin,Kwame,Sunil,Tariq'),
    last: P('Smith,Jones,Williams,Brown,Taylor,Davies,Evans,Thomas,Johnson,Roberts,Walker,Wright,Robinson,Thompson,White,Hughes,Edwards,Green,Hall,Wood,Harris,Lewis,Martin,Jackson,Clarke,Clark,Turner,Hill,Scott,Cooper,Morris,Ward,Moore,King,Watson,Baker,Harrison,Morgan,Patel,Young,Allen,Mitchell,James,Anderson,Phillips,Lee,Bell,Parker,Davis,MacDonald,Campbell,Stewart,Murray,Fraser,Reid,Gallagher,Docherty,Pritchard,Llewellyn,Bradshaw,Atkins,Cartwright,Fletcher,Hargreaves'),
    towns: P('Salford,Bolton,Wigan,Oldham,Sheffield,Leeds,Bradford,Hull,Newcastle,Sunderland,Gateshead,Middlesbrough,Liverpool,Birkenhead,Stoke,Derby,Nottingham,Leicester,Coventry,Birmingham,Walsall,Bristol,Plymouth,Portsmouth,Southampton,Reading,Bermondsey,Stepney,Croydon,Norwich,Ipswich,Cardiff,Swansea,Merthyr Tydfil,Wrexham,Glasgow,Paisley,Dundee,Aberdeen,Inverness,Edinburgh,Belfast,Lisburn,Carlisle,Kendal,Shrewsbury,Hereford,Exeter,Truro')
  },
  cdn: {
    first: P('Albert,Arthur,Bill,Bob,Charlie,Clarence,Don,Earl,Ernie,Frank,Fred,George,Gordon,Harold,Jack,Jim,Joe,Ken,Lloyd,Mac,Murray,Norm,Ray,Roy,Stan,Ted,Wilf,Jean,Pierre,Marcel,Gaston,Lucien,Réal,Roland,André,Gilles'),
    firstModern: P('Kevin,Jason,Chris,Mike,Ryan,Tyler,Kyle,Dave,Steve,Marc,Mathieu,Sébastien,Patrick,Jonathan,Nathan,Owen,Liam,Darcy,Wade,Brent'),
    last: P('MacDonald,Campbell,Fraser,Morrison,Cameron,Stewart,Ross,Grant,McLeod,Murray,Anderson,Brown,Smith,Wilson,Taylor,Johnston,Thompson,Graham,Hamilton,Kennedy,Tremblay,Gagnon,Roy,Côté,Bouchard,Gauthier,Morin,Lavoie,Fortin,Gagné,Ouellet,Pelletier,Bélanger,Lévesque,Boucher,Kowalchuk,Hrynchuk,Kozak,Nadeau,Paquette,Sinclair,Laboucan,Cardinal,Ducharme'),
    towns: P('Moose Jaw SK,Regina SK,Saskatoon SK,Brandon MB,Winnipeg MB,Lethbridge AB,Medicine Hat AB,Calgary AB,Edmonton AB,Kamloops BC,Nanaimo BC,Vancouver BC,Sudbury ON,Kingston ON,Hamilton ON,Owen Sound ON,Windsor ON,Kenora ON,Trois-Rivières QC,Chicoutimi QC,Rimouski QC,Sherbrooke QC,Montreal QC,Moncton NB,Saint John NB,Truro NS,Sydney NS,Charlottetown PE')
  },
  aus: {
    first: P('Bill,Bob,Jack,Jim,Tom,Harry,Fred,George,Ernie,Alf,Bert,Clarrie,Wally,Norm,Les,Reg,Stan,Col,Merv,Keith,Ron,Ray,Laurie,Dougie,Mick,Paddy,Snow,Tiny,Bluey,Darcy'),
    firstModern: P('Matt,Ben,Josh,Luke,Jack,Sam,Dan,Nick,Brad,Shane,Craig,Darren,Scott,Jarrah,Lachlan,Hamish,Mitch,Rhys,Corey,Tane'),
    last: P('Smith,Jones,Williams,Brown,Wilson,Taylor,Johnson,White,Martin,Anderson,Thompson,Walker,Kelly,Ryan,O\'Connor,Murphy,McDonald,Campbell,Stewart,Robertson,Clarke,Mitchell,Hughes,Cooper,Harris,Lee,King,Bennett,Edwards,Hayes,Wallace,Russell,Morgan,Fraser,Hunt,Kennedy,Carroll,Doyle,Ngata,Te Rangi,Parata,Henare,Tamihana'),
    towns: P('Wagga Wagga NSW,Dubbo NSW,Bathurst NSW,Newcastle NSW,Parramatta NSW,Ballarat VIC,Bendigo VIC,Geelong VIC,Footscray VIC,Mildura VIC,Toowoomba QLD,Rockhampton QLD,Townsville QLD,Cairns QLD,Mount Gambier SA,Port Pirie SA,Adelaide SA,Kalgoorlie WA,Fremantle WA,Geraldton WA,Launceston TAS,Hobart TAS,Darwin NT,Gisborne NZ,Rotorua NZ,Whanganui NZ,Dunedin NZ,Invercargill NZ,Napier NZ')
  },
  ind: {
    first: P('Gurbachan,Harnam,Kartar,Bachittar,Jagir,Sohan,Mohan,Ram,Lal,Bahadur,Kulbir,Dil,Lachhiman,Ganju,Tul,Abdul,Ghulam,Mohammad,Fazal,Khan,Sher,Rajinder,Shivaji,Murugan,Subramaniam,Kesar,Umrao,Prem,Chhelu'),
    last: P('Singh,Gurung,Thapa,Rai,Limbu,Pun,Magar,Ram,Lal,Khan,Ahmed,Hussain,Ali,Yadav,Rathore,Chauhan,Jat,Dogra,Naidu,Pillai,Nair,Reddy,Pawar,Jadhav,Bhonsle,Shinde'),
    towns: P('Ludhiana,Amritsar,Jullundur,Ferozepur,Rawalpindi,Jhelum,Peshawar,Kohat,Dehradun,Almora,Gorakhpur,Pokhara district,Gorkha district,Dharan,Kangra,Jhansi,Meerut,Satara,Kolhapur,Madras,Vellore,Coorg')
  },
  fr: {
    first: P('Jean,Pierre,Louis,Marcel,André,René,Henri,Georges,Paul,Maurice,Lucien,Roger,Robert,Raymond,Fernand,Émile,Gaston,Albert,Joseph,Marius,Félix,Léon,Jules,Ahmed,Mohamed,Moussa,Mamadou,Ousmane,Abdel,Youssef'),
    last: P('Martin,Bernard,Dubois,Thomas,Robert,Richard,Petit,Durand,Leroy,Moreau,Simon,Laurent,Lefebvre,Michel,Garcia,David,Bertrand,Roux,Vincent,Fournier,Morel,Girard,André,Mercier,Dupont,Lambert,Bonnet,François,Martinez,Legrand,Garnier,Faure,Rousseau,Blanc,Guerin,Muller,Henry,Perrin,Morin,Mathieu,Ben Ali,Diallo,Traoré,Keïta,Ndiaye,Haddad,Benali'),
    towns: P('Lille,Roubaix,Amiens,Reims,Nancy,Metz,Strasbourg,Besançon,Dijon,Lyon,Saint-Étienne,Grenoble,Marseille,Toulon,Nice,Montpellier,Toulouse,Bordeaux,Limoges,Clermont-Ferrand,Tours,Nantes,Rennes,Brest,Quimper,Rouen,Le Havre,Caen,Paris (11e),Belleville,Oran,Alger,Constantine,Dakar,Bamako')
  },
  ger: {
    first: P('Hans,Karl,Heinz,Werner,Walter,Kurt,Helmut,Günter,Herbert,Willi,Otto,Ernst,Friedrich,Wilhelm,Hermann,Paul,Erich,Rudolf,Gerhard,Horst,Josef,Franz,Alfred,Georg,Heinrich,Fritz,Max,Erwin,Ludwig,Rolf'),
    firstModern: P('Thomas,Michael,Andreas,Stefan,Frank,Jürgen,Uwe,Klaus,Peter,Ralf,Jörg,Matthias,Dirk,Holger,Torsten,Rainer,Bernd,Detlef,Olaf,Sven'),
    last: P('Müller,Schmidt,Schneider,Fischer,Weber,Meyer,Wagner,Becker,Schulz,Hoffmann,Schäfer,Koch,Bauer,Richter,Klein,Wolf,Schröder,Neumann,Schwarz,Zimmermann,Braun,Krüger,Hofmann,Hartmann,Lange,Schmitt,Werner,Schmitz,Krause,Meier,Lehmann,Schmid,Schulze,Maier,Köhler,Herrmann,König,Walter,Mayer,Huber,Kaiser,Fuchs,Peters,Lang,Scholz,Möller,Weiß,Jung,Hahn,Vogel,Kowalczyk,Nowak'),
    towns: P('Hamburg-Altona,Bremen,Kiel,Lübeck,Hannover,Braunschweig,Magdeburg,Halle,Leipzig,Dresden,Chemnitz,Zwickau,Erfurt,Kassel,Dortmund,Bochum,Essen,Duisburg,Düsseldorf,Köln,Aachen,Bonn,Koblenz,Trier,Mainz,Frankfurt,Darmstadt,Mannheim,Heidelberg,Karlsruhe,Stuttgart,Ulm,Augsburg,München,Regensburg,Nürnberg,Würzburg,Passau,Rostock,Stettin,Breslau,Königsberg')
  },
  ah: {
    first: P('Franz,Josef,Karl,Johann,Anton,Alois,Ferenc,János,István,László,Sándor,Jan,Václav,Josef,Karel,Tomáš,Stanisław,Jakub,Ivan,Mato,Ante,Mehmed,Ivo,Milan,Ludwig'),
    last: P('Huber,Gruber,Wagner,Bauer,Pichler,Steiner,Moser,Mayer,Hofer,Leitner,Nagy,Kovács,Tóth,Szabó,Horváth,Varga,Kiss,Novák,Svoboda,Dvořák,Černý,Procházka,Kowalski,Horvat,Kovačević,Babić,Hadžić,Begović'),
    towns: P('Wien,Graz,Linz,Salzburg,Innsbruck,Budapest,Szeged,Debrecen,Pécs,Prag,Brünn,Pilsen,Krakau,Lemberg,Agram,Sarajevo,Mostar,Laibach,Triest,Czernowitz')
  },
  ita: {
    first: P('Giuseppe,Giovanni,Antonio,Mario,Luigi,Francesco,Angelo,Vincenzo,Pietro,Salvatore,Carlo,Franco,Domenico,Bruno,Paolo,Michele,Giorgio,Aldo,Sergio,Renato,Enrico,Ettore,Gino,Nino,Alfredo'),
    last: P('Rossi,Russo,Ferrari,Esposito,Bianchi,Romano,Colombo,Ricci,Marino,Greco,Bruno,Gallo,Conti,De Luca,Mancini,Costa,Giordano,Rizzo,Lombardi,Moretti,Barbieri,Fontana,Santoro,Mariani,Rinaldi,Caruso,Ferrara,Galli,Martini,Leone'),
    towns: P('Torino,Milano,Bergamo,Brescia,Verona,Padova,Venezia,Udine,Trieste,Genova,Bologna,Firenze,Livorno,Perugia,Ancona,Roma,Napoli,Salerno,Bari,Lecce,Reggio Calabria,Palermo,Catania,Cagliari,Sassari')
  },
  ott: {
    first: P('Mehmet,Ahmet,Mustafa,Ali,Hasan,Hüseyin,İbrahim,Osman,Yusuf,Halil,İsmail,Süleyman,Ömer,Abdullah,Kemal,Rıza,Salih,Musa,Bekir,Nuri'),
    last: P('Mehmetoğlu,Alioğlu,Hasanoğlu,Osmanoğlu,Çavuşoğlu,Hacıoğlu,Kara,Deli,Uzun,Topal,Sarı,Kel,Koca,Demirci,Çoban,Kurt,Arslan,Kılıç,Doğan,Aslan'),
    towns: P('Konya,Kayseri,Sivas,Erzurum,Trabzon,Samsun,Ankara,Bursa,İzmir,Manisa,Aydın,Denizli,Adana,Maraş,Antep,Diyarbekir,Mosul,Halep,Şam,Edirne,Kastamonu,Çorum')
  },
  pol: {
    first: P('Jan,Józef,Stanisław,Tadeusz,Władysław,Kazimierz,Antoni,Franciszek,Henryk,Zbigniew,Jerzy,Edward,Marian,Stefan,Andrzej,Czesław,Bolesław,Wacław,Mieczysław,Zygmunt'),
    last: P('Nowak,Kowalski,Wiśniewski,Wójcik,Kowalczyk,Kamiński,Lewandowski,Zieliński,Szymański,Woźniak,Dąbrowski,Kozłowski,Jankowski,Mazur,Kwiatkowski,Krawczyk,Piotrowski,Grabowski,Pawłowski,Michalski,Nowicki,Adamczyk,Dudek,Zając,Wieczorek'),
    towns: P('Warszawa,Kraków,Łódź,Wilno,Lwów,Poznań,Gdynia,Katowice,Lublin,Białystok,Grodno,Tarnopol,Stanisławów,Częstochowa,Radom,Kielce,Przemyśl,Nowy Sącz')
  },
  sov: {
    first: P('Ivan,Pyotr,Nikolai,Aleksei,Sergei,Vasily,Mikhail,Dmitri,Grigory,Fyodor,Andrei,Pavel,Yakov,Semyon,Stepan,Viktor,Boris,Leonid,Anatoly,Yuri,Taras,Mykola,Oleksandr,Bogdan,Arkady,Ilya,Timur,Rustam,Bakhyt,Nurlan,Akhmet,Givi,Vano,Ashot,Sabir,Kamil,Rafael'),
    firstModern: P('Sergei,Aleksandr,Andrei,Dmitri,Igor,Oleg,Vladimir,Yevgeny,Konstantin,Vadim,Roman,Denis,Ruslan,Timur,Farid,Azamat,Arman,Dauren,Valery,Gennady'),
    last: P('Ivanov,Petrov,Sidorov,Smirnov,Kuznetsov,Popov,Sokolov,Lebedev,Kozlov,Novikov,Morozov,Volkov,Solovyov,Vasiliev,Zaitsev,Pavlov,Semyonov,Golubev,Vinogradov,Bogdanov,Vorobyov,Fyodorov,Mikhailov,Belyaev,Tarasov,Belov,Komarov,Orlov,Kiselyov,Makarov,Shevchenko,Kovalenko,Bondarenko,Tkachenko,Kravchenko,Melnyk,Karimov,Nazarbayev,Abdullayev,Yusupov,Gabidullin,Beridze,Kapanadze,Hakobyan,Petrosyan,Ismailov,Aliyev,Lysenko,Grishin,Chernov'),
    towns: P('Tula,Ryazan,Kaluga,Smolensk,Tver,Yaroslavl,Vologda,Arkhangelsk,Gorky,Kazan,Samara,Saratov,Stalingrad,Rostov,Krasnodar,Voronezh,Kursk,Orel,Bryansk,Kharkov,Poltava,Kiev,Vinnitsa,Odessa,Dnepropetrovsk,Minsk,Vitebsk,Sverdlovsk,Chelyabinsk,Perm,Ufa,Omsk,Novosibirsk,Tomsk,Irkutsk,Khabarovsk,Alma-Ata,Karaganda,Tashkent,Samarkand,Tbilisi,Kutaisi,Yerevan,Baku,Leningrad,Murmansk')
  },
  jpn: {
    first: P('Hiroshi,Takeshi,Kenji,Ichiro,Jiro,Saburo,Shiro,Masao,Tadashi,Yoshio,Isamu,Kiyoshi,Minoru,Shigeru,Tsutomu,Akira,Hideo,Kazuo,Noboru,Osamu,Satoru,Toshio,Yukio,Haruo,Fumio'),
    last: P('Sato,Suzuki,Takahashi,Tanaka,Watanabe,Ito,Yamamoto,Nakamura,Kobayashi,Kato,Yoshida,Yamada,Sasaki,Yamaguchi,Matsumoto,Inoue,Kimura,Hayashi,Shimizu,Yamazaki,Mori,Abe,Ikeda,Hashimoto,Ishikawa,Ogawa,Okada,Goto,Hasegawa,Murakami,Kondo,Ishii,Sakamoto,Endo,Aoki,Fujii,Nishimura,Fukuda,Ota,Miura'),
    towns: P('Sendai,Akita,Aomori,Morioka,Fukushima,Niigata,Kanazawa,Fukui,Nagano,Matsumoto,Kofu,Shizuoka,Hamamatsu,Nagoya,Gifu,Tsu,Kyoto,Osaka,Kobe,Himeji,Okayama,Hiroshima,Kure,Yamaguchi,Matsuyama,Kochi,Fukuoka,Kumamoto,Kagoshima,Asahikawa,Sapporo,Hakodate')
  },
  kor: {
    first: P('Min-su,Young-ho,Sung-jin,Jae-hyun,Dong-hyun,Sang-woo,Chul-soo,Kwang-ho,Myung-soo,Byung-chul,Jong-il,Hyun-woo,Ki-young,Tae-ho,Seung-ho,Jin-ho,Yong-su,Man-sik,Kyung-soo,Dae-sung'),
    last: P('Kim,Lee,Park,Choi,Jung,Kang,Cho,Yoon,Jang,Lim,Han,Oh,Seo,Shin,Kwon,Hwang,Ahn,Song,Yoo,Hong,Jeon,Ko,Moon,Yang,Baek'),
    towns: P('Pusan,Taegu,Taejon,Kwangju,Mokpo,Masan,Pohang,Andong,Chonju,Chongju,Wonju,Chuncheon,Kangnung,Suwon,Inchon,Seoul,Kaesong,Pyongyang,Wonsan,Hamhung,Sinuiju,Chongjin,Haeju,Sariwon')
  },
  chn: {
    first: P('Jianguo,Weiguo,Zhiqiang,Guoqiang,Dewei,Jianhua,Yongfu,Changsheng,Shufen,Hongwei,Xueliang,Baoguo,Fuqiang,Zhenhua,Wenbin,Liang,Ming,Tao,Bin,Hai'),
    last: P('Wang,Li,Zhang,Liu,Chen,Yang,Huang,Zhao,Wu,Zhou,Xu,Sun,Ma,Zhu,Hu,Guo,He,Gao,Lin,Luo,Zheng,Liang,Xie,Song,Tang'),
    towns: P('Shenyang,Dalian,Anshan,Harbin,Changchun,Jilin,Qiqihar,Jinan,Qingdao,Linyi,Xuzhou,Kaifeng,Zhengzhou,Luoyang,Shijiazhuang,Baoding,Taiyuan,Datong,Xi\'an,Yan\'an,Changsha,Hengyang,Chengdu,Chongqing,Nanchang')
  },
  vie: {
    first: P('Văn Hùng,Văn Minh,Văn Thắng,Văn Long,Văn Nam,Văn Hải,Văn Tuấn,Văn Dũng,Văn Lợi,Đức Anh,Quốc Bảo,Thanh Sơn,Văn Bình,Văn Phúc,Hữu Nghĩa,Xuân Trường,Văn Tâm,Ngọc Lâm,Công Hoan,Văn Toàn'),
    last: P('Nguyễn,Trần,Lê,Phạm,Hoàng,Huỳnh,Phan,Vũ,Võ,Đặng,Bùi,Đỗ,Hồ,Ngô,Dương,Lý,Đinh,Trịnh,Lương,Mai'),
    towns: P('Thái Bình,Nam Định,Hà Nam,Ninh Bình,Thanh Hóa,Nghệ An,Hà Tĩnh,Quảng Bình,Hải Dương,Hưng Yên,Bắc Ninh,Phú Thọ,Huế,Quảng Ngãi,Quảng Nam,Đà Nẵng,Biên Hòa,Mỹ Tho,Cần Thơ,Long An,Tây Ninh,Bến Tre,Sài Gòn,Vĩnh Long,Châu Đốc')
  },
  arg: {
    first: P('Juan,Carlos,José,Jorge,Luis,Miguel,Daniel,Roberto,Ricardo,Oscar,Héctor,Sergio,Gustavo,Marcelo,Fernando,Alberto,Raúl,Néstor,Walter,Rubén'),
    last: P('González,Rodríguez,Gómez,Fernández,López,Díaz,Martínez,Pérez,Romero,Sánchez,García,Sosa,Torres,Álvarez,Ruiz,Ramírez,Flores,Benítez,Acosta,Medina,Herrera,Aguirre,Giménez,Molina,Silva,Castro,Rojas,Ortiz,Luna,Juárez'),
    towns: P('Corrientes,Resistencia,Formosa,Posadas,Santiago del Estero,Tucumán,Salta,Jujuy,La Rioja,Catamarca,Córdoba,Río Cuarto,Rosario,Santa Fe,Paraná,Mendoza,San Juan,San Luis,La Plata,Mar del Plata,Bahía Blanca,Neuquén,Comodoro Rivadavia,Río Gallegos')
  },
  irq: {
    first: P('Ahmed,Mohammed,Ali,Hussein,Hassan,Abbas,Karim,Kadhim,Jassim,Salim,Mahmoud,Khalid,Omar,Ibrahim,Yousif,Haider,Mustafa,Saad,Falah,Raad,Sami,Wissam,Ammar,Firas,Qasim'),
    last: P('al-Jubouri,al-Dulaimi,al-Tamimi,al-Obeidi,al-Shammari,al-Zubaidi,al-Rubaie,al-Saadi,al-Maliki,al-Bayati,al-Hashimi,al-Janabi,al-Azzawi,al-Khafaji,al-Kubaisi,al-Hamdani,al-Mosawi,al-Rawi,Barzani,Talabani,Mahmoud,Hussein,Abdullah,Kareem,Salman'),
    towns: P('Baghdad,Basra,Mosul,Kirkuk,Najaf,Karbala,Hillah,Diwaniyah,Nasiriyah,Amarah,Kut,Samawah,Ramadi,Fallujah,Tikrit,Samarra,Baqubah,Erbil,Sulaymaniyah,Dohuk,Haditha,Tal Afar')
  },
  afg: {
    first: P('Ahmad,Mohammad,Abdul,Gul,Rahim,Karim,Habib,Hamid,Nasir,Wahid,Zabihullah,Rahmatullah,Jawad,Farid,Sayed,Najib,Shafiq,Qadir,Bashir,Hekmat,Mirwais,Khalil,Aziz,Hazrat,Noor'),
    last: P('Ahmadzai,Popalzai,Barakzai,Durrani,Ghilzai,Safi,Wardak,Mohmand,Shinwari,Hazara,Sadat,Panjshiri,Tajik,Rahimi,Karimi,Hamidi,Nazari,Sultani,Habibi,Noori,Amiri,Stanikzai,Mangal,Zadran'),
    towns: P('Kabul,Kandahar,Herat,Mazar-i-Sharif,Jalalabad,Kunduz,Ghazni,Bamyan,Charikar,Gardez,Khost,Lashkar Gah,Faizabad,Pul-i-Khumri,Taloqan,Maidan Shahr,Mehtar Lam,Asadabad')
  },
  // Fictional nations for the near-future war.
  alc: {
    first: P('Aaron,Bram,Caleb,Dario,Elias,Finn,Gideon,Hal,Ivo,Jonah,Kai,Leander,Mateo,Niall,Oren,Piet,Quinn,Rafe,Soren,Tobin,Ulric,Vance,Wes,Yannick,Zane,Amara,Brigid,Cass,Della,Esme'),
    last: P('Ashdown,Brennick,Calloway,Dunmore,Ellery,Fairholt,Garrow,Halloran,Ingram,Jessop,Kettering,Lisle,Marwick,Northam,Orrell,Pellow,Quarrie,Redfern,Saltash,Thorne,Underhill,Varga,Westbrook,Yarrow,Abiodun,Okafor,Mensah,Delacroix,Ferreira,Novak,Halvorsen,Takeda,Raman,Castellanos'),
    towns: P('Port Alder,Saltmarch,Greyhaven,Elmsford,Kingsreach,Stonebridge,Harrowgate,Westerly,Mirefield,Corran Bay,Lowmoor,Ravensholt,Ashcombe,New Calder,Fenwick Cross,Brightwater')
  },
  varn: {
    first: P('Arvo,Branik,Dorran,Evik,Gavrel,Haskel,Ilvo,Jarek,Kasimir,Lorn,Marek,Nestor,Orvik,Pell,Radko,Stavan,Tomik,Ulv,Varek,Zoltan,Ansel,Daro,Feodric,Grigo,Ivar'),
    last: P('Varenko,Draskovan,Holmrik,Kestovar,Lunev,Mardovic,Norvaskin,Orlenko,Petravin,Radomir,Saskovar,Tarnev,Ulmarin,Vasko,Zherin,Abrek,Belovar,Corvan,Dunavik,Erskov,Falkenrod,Gorsvan,Halvic,Ironov,Jasmorin'),
    towns: P('Varnholm,Krasta,Oltmar,Dravsk,Ilmenrod,Kostavar,Lugansk-on-Vey,Merovy,Nordvar,Ostrel,Pelgrad,Rusk,Sarnovo,Tevrin,Vyshgard,Zelmar')
  },
  kest: {
    first: P('Anders,Bjarne,Carsten,Dag,Einar,Fredrik,Gunnar,Halvard,Ivar,Jens,Knut,Lars,Magnus,Nils,Olav,Per,Rune,Stig,Tor,Ulf,Vidar,Arne,Siri,Linnea,Maja'),
    last: P('Aaland,Berget,Dahl,Eklund,Fjeld,Grønvik,Haugen,Isaksen,Jervell,Kvist,Lindahl,Moen,Nordby,Ostrem,Ruud,Strand,Torvik,Ulstad,Vang,Wennberg,Halsvik,Brekke,Solberg,Rask'),
    towns: P('Kestrelhavn,Nordsund,Ostvik,Fjellby,Saltnes,Brennholm,Granvik,Lysøya,Tindefjord,Vestmark,Hallsberg,Myrvang')
  }
};

/** The pool for a nationality, falling back to US. */
export function pool(key) { return NAMES[key] || NAMES.us; }
