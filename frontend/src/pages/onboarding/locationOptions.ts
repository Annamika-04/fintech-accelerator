export const NATIONALITIES = [
  "Afghan","Albanian","Algerian","American","Andorran","Angolan","Argentine","Armenian",
  "Australian","Austrian","Azerbaijani","Bahraini","Bangladeshi","Belarusian","Belgian",
  "Bolivian","Bosnian","Brazilian","British","Bulgarian","Cambodian","Cameroonian","Canadian",
  "Chilean","Chinese","Colombian","Congolese","Croatian","Cuban","Czech","Danish","Dutch",
  "Ecuadorian","Egyptian","Emirati","Estonian","Ethiopian","Filipino","Finnish","French",
  "Georgian","German","Ghanaian","Greek","Guatemalan","Honduran","Hungarian","Indian",
  "Indonesian","Iranian","Iraqi","Irish","Israeli","Italian","Jamaican","Japanese","Jordanian",
  "Kazakhstani","Kenyan","Korean","Kuwaiti","Kyrgyz","Lao","Latvian","Lebanese","Libyan",
  "Lithuanian","Luxembourgish","Malaysian","Maldivian","Malian","Maltese","Mexican","Moldovan",
  "Mongolian","Moroccan","Mozambican","Namibian","Nepalese","New Zealander","Nicaraguan",
  "Nigerian","Norwegian","Omani","Pakistani","Palestinian","Panamanian","Paraguayan","Peruvian",
  "Polish","Portuguese","Qatari","Romanian","Russian","Rwandan","Saudi","Senegalese","Serbian",
  "Singaporean","Slovak","Slovenian","Somali","South African","Spanish","Sri Lankan","Sudanese",
  "Swedish","Swiss","Syrian","Taiwanese","Tajik","Tanzanian","Thai","Tunisian","Turkish",
  "Turkmen","Ugandan","Ukrainian","Uruguayan","Uzbek","Venezuelan","Vietnamese","Yemeni",
  "Zambian","Zimbabwean",
];

export const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bahrain","Bangladesh","Belarus","Belgium","Bolivia",
  "Bosnia and Herzegovina","Brazil","Bulgaria","Cambodia","Cameroon","Canada","Chile",
  "China","Colombia","Congo","Croatia","Cuba","Czech Republic","Denmark","Ecuador","Egypt",
  "Estonia","Ethiopia","Finland","France","Georgia","Germany","Ghana","Greece","Guatemala",
  "Honduras","Hungary","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica",
  "Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon",
  "Libya","Lithuania","Luxembourg","Malaysia","Maldives","Mali","Malta","Mexico","Moldova",
  "Mongolia","Morocco","Mozambique","Namibia","Nepal","Netherlands","New Zealand","Nicaragua",
  "Nigeria","Norway","Oman","Pakistan","Palestine","Panama","Paraguay","Peru","Philippines",
  "Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saudi Arabia","Senegal","Serbia",
  "Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","Spain","Sri Lanka",
  "Sudan","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Tunisia",
  "Turkey","Turkmenistan","Uganda","Ukraine","United Arab Emirates","United Kingdom",
  "United States","Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe",
];

export const OCCUPATIONS = [
  "Accountant","Architect","Business Owner","Chartered Accountant","Civil Servant",
  "Consultant","Doctor","Engineer","Freelancer","Homemaker","Lawyer","Marketing Professional",
  "Nurse","Retired","Sales Professional","Self Employed","Software Engineer","Student",
  "Teacher","Trader",
];

export const INDUSTRIES = [
  "Accounting","Agriculture","Automotive","Construction","Consulting","Consumer Goods",
  "Education","Energy","Financial Services","Food and Beverage","Government","Healthcare",
  "Hospitality","Information Technology","Insurance","Legal Services","Logistics",
  "Manufacturing","Media and Entertainment","Pharmaceuticals","Professional Services",
  "Real Estate","Retail","Telecommunications","Transportation","Travel and Tourism",
];

export const INDIA_STATES: Record<string, string[]> = {
  "Andhra Pradesh":["Visakhapatnam","Vijayawada","Guntur","Nellore","Kurnool","Tirupati","Kakinada","Rajahmundry","Kadapa","Anantapur","Eluru","Ongole","Chittoor","Srikakulam","Vizianagaram"],
  "Arunachal Pradesh":["Itanagar","Naharlagun","Pasighat","Tawang","Ziro","Bomdila","Tezu"],
  "Assam":["Guwahati","Silchar","Dibrugarh","Jorhat","Nagaon","Tinsukia","Tezpur","Bongaigaon","Dhubri","Goalpara","Karimganj"],
  "Bihar":["Patna","Gaya","Bhagalpur","Muzaffarpur","Purnia","Darbhanga","Bihar Sharif","Arrah","Begusarai","Katihar","Munger","Chapra","Hajipur","Saharsa"],
  "Chhattisgarh":["Raipur","Bhilai","Bilaspur","Korba","Durg","Rajnandgaon","Jagdalpur","Ambikapur","Raigarh"],
  "Goa":["Panaji","Margao","Vasco da Gama","Mapusa","Ponda","Bicholim","Curchorem"],
  "Gujarat":["Ahmedabad","Surat","Vadodara","Rajkot","Bhavnagar","Jamnagar","Gandhinagar","Junagadh","Anand","Nadiad","Morbi","Surendranagar","Bharuch","Mehsana","Botad"],
  "Haryana":["Faridabad","Gurgaon","Panipat","Ambala","Yamunanagar","Rohtak","Hisar","Karnal","Sonipat","Panchkula","Bhiwani","Sirsa","Rewari","Jhajjar"],
  "Himachal Pradesh":["Shimla","Dharamshala","Solan","Mandi","Kullu","Hamirpur","Una","Bilaspur","Nahan","Palampur"],
  "Jharkhand":["Ranchi","Jamshedpur","Dhanbad","Bokaro","Deoghar","Hazaribagh","Giridih","Dumka","Phusro","Adityapur"],
  "Karnataka":["Bengaluru","Mysuru","Hubli","Mangaluru","Belagavi","Kalaburagi","Davanagere","Ballari","Vijayapura","Shivamogga","Tumkur","Bidar","Raichur","Hassan","Udupi"],
  "Kerala":["Thiruvananthapuram","Kochi","Kozhikode","Thrissur","Kollam","Palakkad","Alappuzha","Kannur","Kottayam","Malappuram","Kasaragod","Pathanamthitta","Idukki","Wayanad"],
  "Madhya Pradesh":["Bhopal","Indore","Jabalpur","Gwalior","Ujjain","Sagar","Dewas","Satna","Ratlam","Rewa","Murwara","Singrauli","Burhanpur","Khandwa","Bhind"],
  "Maharashtra":["Mumbai","Pune","Nagpur","Nashik","Aurangabad","Solapur","Amravati","Kolhapur","Thane","Navi Mumbai","Pimpri-Chinchwad","Kalyan","Vasai-Virar","Malegaon","Jalgaon","Akola","Latur","Dhule","Ahmednagar","Chandrapur"],
  "Manipur":["Imphal","Thoubal","Bishnupur","Churachandpur","Senapati","Ukhrul","Tamenglong"],
  "Meghalaya":["Shillong","Tura","Jowai","Nongstoin","Baghmara"],
  "Mizoram":["Aizawl","Lunglei","Champhai","Serchhip","Kolasib"],
  "Nagaland":["Kohima","Dimapur","Mokokchung","Tuensang","Wokha","Zunheboto"],
  "Odisha":["Bhubaneswar","Cuttack","Rourkela","Brahmapur","Sambalpur","Puri","Balasore","Bhadrak","Baripada","Jharsuguda"],
  "Punjab":["Ludhiana","Amritsar","Jalandhar","Patiala","Bathinda","Mohali","Hoshiarpur","Gurdaspur","Pathankot","Moga","Firozpur","Sangrur"],
  "Rajasthan":["Jaipur","Jodhpur","Kota","Bikaner","Ajmer","Udaipur","Bhilwara","Alwar","Bharatpur","Sikar","Pali","Sri Ganganagar","Barmer","Tonk","Churu"],
  "Sikkim":["Gangtok","Namchi","Gyalshing","Mangan","Rangpo"],
  "Tamil Nadu":["Chennai","Coimbatore","Madurai","Tiruchirappalli","Salem","Tirunelveli","Tiruppur","Vellore","Erode","Thoothukudi","Dindigul","Thanjavur","Ranipet","Sivakasi","Karur","Hosur","Nagercoil","Kanchipuram","Kumbakonam","Cuddalore"],
  "Telangana":["Hyderabad","Warangal","Nizamabad","Karimnagar","Khammam","Ramagundam","Mahbubnagar","Nalgonda","Adilabad","Suryapet","Miryalaguda","Siddipet"],
  "Tripura":["Agartala","Dharmanagar","Udaipur","Kailasahar","Belonia","Ambassa"],
  "Uttar Pradesh":["Lucknow","Kanpur","Agra","Varanasi","Meerut","Allahabad","Ghaziabad","Noida","Bareilly","Aligarh","Moradabad","Saharanpur","Gorakhpur","Firozabad","Jhansi","Mathura","Muzaffarnagar","Rampur","Shahjahanpur","Farrukhabad"],
  "Uttarakhand":["Dehradun","Haridwar","Roorkee","Haldwani","Rudrapur","Kashipur","Rishikesh","Nainital","Mussoorie","Pithoragarh"],
  "West Bengal":["Kolkata","Howrah","Durgapur","Asansol","Siliguri","Bardhaman","Malda","Baharampur","Habra","Kharagpur","Shantipur","Dankuni","Dhulian","Ranaghat"],
  "Delhi":["New Delhi","Dwarka","Rohini","Janakpuri","Laxmi Nagar","Saket","Pitampura","Karol Bagh","Connaught Place","Vasant Kunj","Mayur Vihar","Preet Vihar","Shahdara","Narela"],
  "Jammu and Kashmir":["Srinagar","Jammu","Anantnag","Baramulla","Sopore","Kathua","Udhampur","Punch"],
  "Ladakh":["Leh","Kargil"],
  "Chandigarh":["Chandigarh"],
  "Puducherry":["Puducherry","Karaikal","Mahe","Yanam"],
  "Andaman and Nicobar Islands":["Port Blair","Diglipur","Rangat"],
  "Dadra and Nagar Haveli and Daman and Diu":["Silvassa","Daman","Diu"],
  "Lakshadweep":["Kavaratti","Agatti","Minicoy"],
};

export const ALL_STATES = Object.keys(INDIA_STATES).sort();

export const getCitySuggestions = (country: string, state: string) =>
  country === "India" && state && INDIA_STATES[state] ? INDIA_STATES[state] : [];
