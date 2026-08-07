"""
AirYatra Multi-Language Email Content
Languages: English, Hindi, Marathi, Tamil, Gujarati
"""

from typing import Dict, Any

# ==================== LANGUAGE CONFIGURATIONS ====================

SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "native": "English", "flag": "🇬🇧", "rtl": False},
    "hi": {"name": "Hindi", "native": "हिंदी", "flag": "🇮🇳", "rtl": False},
    "mr": {"name": "Marathi", "native": "मराठी", "flag": "🇮🇳", "rtl": False},
    "ta": {"name": "Tamil", "native": "தமிழ்", "flag": "🇮🇳", "rtl": False},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી", "flag": "🇮🇳", "rtl": False},
}

# ==================== COMMON TRANSLATIONS ====================

COMMON_STRINGS = {
    "en": {
        "namaste": "Hello",
        "thank_you": "Thank you",
        "booking_id": "Booking ID",
        "route": "Route",
        "date": "Date",
        "time": "Time",
        "passengers": "Passengers",
        "amount": "Amount",
        "total_amount": "Total Amount",
        "payment_status": "Payment Status",
        "paid": "Paid",
        "pending": "Pending",
        "view_booking": "View Booking Details",
        "contact_support": "Contact Support",
        "important_instructions": "Important Instructions",
        "pre_flight_checklist": "Pre-Flight Checklist",
        "reporting_time": "Reporting Time",
        "helipad": "Helipad",
        "address": "Address",
        "get_directions": "Get Directions",
        "old_schedule": "Old Schedule",
        "new_schedule": "New Schedule",
        "reason": "Reason",
        "refund_amount": "Refund Amount",
        "refund_status": "Refund Status",
        "refund_timeline": "Expected Timeline",
        "rate_experience": "Rate Your Experience",
        "fly_again": "Book Another Flight",
        "inquiry_id": "Inquiry ID",
        "travel_date": "Travel Date",
        "estimated_price": "Estimated Price",
        "what_next": "What happens next?",
        "otp_code": "Your verification code is",
        "otp_valid": "Valid for",
        "minutes": "minutes",
        "security_warning": "Security Warning",
        "never_share_otp": "Never share this OTP with anyone",
        "footer_tagline": "Elevating India's Aviation Experience",
        "copyright": "All rights reserved",
    },
    "hi": {
        "namaste": "नमस्ते",
        "thank_you": "धन्यवाद",
        "booking_id": "बुकिंग आईडी",
        "route": "मार्ग",
        "date": "तारीख",
        "time": "समय",
        "passengers": "यात्री",
        "amount": "राशि",
        "total_amount": "कुल राशि",
        "payment_status": "भुगतान स्थिति",
        "paid": "भुगतान हो गया",
        "pending": "लंबित",
        "view_booking": "बुकिंग विवरण देखें",
        "contact_support": "सहायता से संपर्क करें",
        "important_instructions": "महत्वपूर्ण निर्देश",
        "pre_flight_checklist": "उड़ान पूर्व चेकलिस्ट",
        "reporting_time": "रिपोर्टिंग समय",
        "helipad": "हेलीपैड",
        "address": "पता",
        "get_directions": "दिशा-निर्देश प्राप्त करें",
        "old_schedule": "पुरानी अनुसूची",
        "new_schedule": "नई अनुसूची",
        "reason": "कारण",
        "refund_amount": "वापसी राशि",
        "refund_status": "वापसी स्थिति",
        "refund_timeline": "अपेक्षित समयसीमा",
        "rate_experience": "अपना अनुभव रेट करें",
        "fly_again": "एक और उड़ान बुक करें",
        "inquiry_id": "पूछताछ आईडी",
        "travel_date": "यात्रा तिथि",
        "estimated_price": "अनुमानित मूल्य",
        "what_next": "आगे क्या होगा?",
        "otp_code": "आपका सत्यापन कोड है",
        "otp_valid": "के लिए मान्य",
        "minutes": "मिनट",
        "security_warning": "सुरक्षा चेतावनी",
        "never_share_otp": "इस OTP को कभी किसी के साथ साझा न करें",
        "footer_tagline": "भारत के विमानन अनुभव को ऊंचाई दे रहे हैं",
        "copyright": "सर्वाधिकार सुरक्षित",
    },
    "mr": {
        "namaste": "नमस्कार",
        "thank_you": "धन्यवाद",
        "booking_id": "बुकिंग आयडी",
        "route": "मार्ग",
        "date": "तारीख",
        "time": "वेळ",
        "passengers": "प्रवासी",
        "amount": "रक्कम",
        "total_amount": "एकूण रक्कम",
        "payment_status": "पेमेंट स्थिती",
        "paid": "पेमेंट झाले",
        "pending": "प्रलंबित",
        "view_booking": "बुकिंग तपशील पहा",
        "contact_support": "सपोर्टशी संपर्क साधा",
        "important_instructions": "महत्त्वाच्या सूचना",
        "pre_flight_checklist": "उड्डाणपूर्व चेकलिस्ट",
        "reporting_time": "रिपोर्टिंग वेळ",
        "helipad": "हेलिपॅड",
        "address": "पत्ता",
        "get_directions": "दिशानिर्देश मिळवा",
        "old_schedule": "जुने वेळापत्रक",
        "new_schedule": "नवीन वेळापत्रक",
        "reason": "कारण",
        "refund_amount": "परतावा रक्कम",
        "refund_status": "परतावा स्थिती",
        "refund_timeline": "अपेक्षित कालावधी",
        "rate_experience": "तुमचा अनुभव रेट करा",
        "fly_again": "आणखी एक फ्लाइट बुक करा",
        "inquiry_id": "चौकशी आयडी",
        "travel_date": "प्रवास तारीख",
        "estimated_price": "अंदाजित किंमत",
        "what_next": "पुढे काय होईल?",
        "otp_code": "तुमचा पडताळणी कोड आहे",
        "otp_valid": "साठी वैध",
        "minutes": "मिनिटे",
        "security_warning": "सुरक्षा इशारा",
        "never_share_otp": "हा OTP कोणाशीही शेअर करू नका",
        "footer_tagline": "भारताच्या विमान वाहतूक अनुभवाला उंची देत आहोत",
        "copyright": "सर्व हक्क राखीव",
    },
    "ta": {
        "namaste": "வணக்கம்",
        "thank_you": "நன்றி",
        "booking_id": "முன்பதிவு எண்",
        "route": "பாதை",
        "date": "தேதி",
        "time": "நேரம்",
        "passengers": "பயணிகள்",
        "amount": "தொகை",
        "total_amount": "மொத்த தொகை",
        "payment_status": "பணம் செலுத்தும் நிலை",
        "paid": "செலுத்தப்பட்டது",
        "pending": "நிலுவையில்",
        "view_booking": "முன்பதிவு விவரங்களைக் காண்க",
        "contact_support": "ஆதரவைத் தொடர்பு கொள்ளவும்",
        "important_instructions": "முக்கிய அறிவுறுத்தல்கள்",
        "pre_flight_checklist": "பறப்புக்கு முந்தைய சரிபார்ப்பு பட்டியல்",
        "reporting_time": "அறிக்கை நேரம்",
        "helipad": "ஹெலிபேட்",
        "address": "முகவரி",
        "get_directions": "வழிகளைப் பெறுக",
        "old_schedule": "பழைய அட்டவணை",
        "new_schedule": "புதிய அட்டவணை",
        "reason": "காரணம்",
        "refund_amount": "திரும்பப் பெறும் தொகை",
        "refund_status": "திரும்பப் பெறும் நிலை",
        "refund_timeline": "எதிர்பார்க்கப்படும் காலக்கெடு",
        "rate_experience": "உங்கள் அனுபவத்தை மதிப்பிடுங்கள்",
        "fly_again": "மற்றொரு விமானத்தை முன்பதிவு செய்யுங்கள்",
        "inquiry_id": "விசாரணை எண்",
        "travel_date": "பயண தேதி",
        "estimated_price": "மதிப்பிடப்பட்ட விலை",
        "what_next": "அடுத்து என்ன நடக்கும்?",
        "otp_code": "உங்கள் சரிபார்ப்பு குறியீடு",
        "otp_valid": "க்கு செல்லுபடியாகும்",
        "minutes": "நிமிடங்கள்",
        "security_warning": "பாதுகாப்பு எச்சரிக்கை",
        "never_share_otp": "இந்த OTP-ஐ யாரிடமும் பகிர வேண்டாம்",
        "footer_tagline": "இந்தியாவின் விமான அனுபவத்தை உயர்த்துகிறோம்",
        "copyright": "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை",
    },
    "gu": {
        "namaste": "નમસ્તે",
        "thank_you": "આભાર",
        "booking_id": "બુકિંગ આઈડી",
        "route": "રૂટ",
        "date": "તારીખ",
        "time": "સમય",
        "passengers": "મુસાફરો",
        "amount": "રકમ",
        "total_amount": "કુલ રકમ",
        "payment_status": "ચુકવણી સ્થિતિ",
        "paid": "ચૂકવણી થઈ ગઈ",
        "pending": "બાકી",
        "view_booking": "બુકિંગ વિગતો જુઓ",
        "contact_support": "સપોર્ટનો સંપર્ક કરો",
        "important_instructions": "મહત્વપૂર્ણ સૂચનાઓ",
        "pre_flight_checklist": "ફ્લાઇટ પહેલાની ચેકલિસ્ટ",
        "reporting_time": "રિપોર્ટિંગ સમય",
        "helipad": "હેલિપેડ",
        "address": "સરનામું",
        "get_directions": "દિશાઓ મેળવો",
        "old_schedule": "જૂનું શેડ્યૂલ",
        "new_schedule": "નવું શેડ્યૂલ",
        "reason": "કારણ",
        "refund_amount": "રિફંડ રકમ",
        "refund_status": "રિફંડ સ્થિતિ",
        "refund_timeline": "અપેક્ષિત સમયમર્યાદા",
        "rate_experience": "તમારો અનુભવ રેટ કરો",
        "fly_again": "બીજી ફ્લાઇટ બુક કરો",
        "inquiry_id": "પૂછપરછ આઈડી",
        "travel_date": "મુસાફરીની તારીખ",
        "estimated_price": "અંદાજિત કિંમત",
        "what_next": "આગળ શું થશે?",
        "otp_code": "તમારો ચકાસણી કોડ છે",
        "otp_valid": "માટે માન્ય",
        "minutes": "મિનિટ",
        "security_warning": "સુરક્ષા ચેતવણી",
        "never_share_otp": "આ OTP કોઈની સાથે શેર કરશો નહીં",
        "footer_tagline": "ભારતના ઉડ્ડયન અનુભવને ઊંચાઈ આપી રહ્યા છીએ",
        "copyright": "બધા હક્કો સુરક્ષિત",
    },
}

# ==================== EMAIL-SPECIFIC TRANSLATIONS ====================

EMAIL_TRANSLATIONS = {
    "booking_confirmation": {
        "en": {
            "title": "Booking Confirmed!",
            "subtitle": "Your helicopter journey awaits",
            "badge": "✅ CONFIRMED",
            "greeting": "Your helicopter booking has been confirmed. Get ready for an amazing aerial experience!",
            "flight_details": "Flight Details",
            "payment_summary": "Payment Summary",
            "instructions": [
                "Please arrive at the helipad 30 minutes before departure",
                "Carry a valid government-issued photo ID (Aadhaar/Passport/DL)",
                "Maximum baggage allowed: 7 kg per passenger",
                "Weather conditions may affect flight timings"
            ]
        },
        "hi": {
            "title": "बुकिंग कन्फर्म!",
            "subtitle": "आपकी हेलीकॉप्टर यात्रा का इंतजार है",
            "badge": "✅ कन्फर्म",
            "greeting": "आपकी हेलीकॉप्टर बुकिंग कन्फर्म हो गई है। एक शानदार हवाई अनुभव के लिए तैयार हो जाइए!",
            "flight_details": "उड़ान विवरण",
            "payment_summary": "भुगतान सारांश",
            "instructions": [
                "कृपया प्रस्थान से 30 मिनट पहले हेलीपैड पर पहुंचें",
                "एक वैध सरकारी फोटो आईडी ले जाएं (आधार/पासपोर्ट/DL)",
                "अधिकतम सामान: प्रति यात्री 7 किग्रा",
                "मौसम की स्थिति उड़ान के समय को प्रभावित कर सकती है"
            ]
        },
        "mr": {
            "title": "बुकिंग कन्फर्म!",
            "subtitle": "तुमची हेलिकॉप्टर यात्रा वाट पाहत आहे",
            "badge": "✅ कन्फर्म",
            "greeting": "तुमची हेलिकॉप्टर बुकिंग कन्फर्म झाली आहे. एका अद्भुत हवाई अनुभवासाठी सज्ज व्हा!",
            "flight_details": "उड्डाण तपशील",
            "payment_summary": "पेमेंट सारांश",
            "instructions": [
                "कृपया निघण्याच्या 30 मिनिटे आधी हेलिपॅडवर पोहोचा",
                "वैध सरकारी फोटो ओळखपत्र घेऊन जा (आधार/पासपोर्ट/DL)",
                "जास्तीत जास्त सामान: प्रति प्रवासी 7 किलो",
                "हवामान परिस्थिती उड्डाण वेळेवर परिणाम करू शकते"
            ]
        },
        "ta": {
            "title": "முன்பதிவு உறுதி!",
            "subtitle": "உங்கள் ஹெலிகாப்டர் பயணம் காத்திருக்கிறது",
            "badge": "✅ உறுதிப்படுத்தப்பட்டது",
            "greeting": "உங்கள் ஹெலிகாப்டர் முன்பதிவு உறுதிப்படுத்தப்பட்டது. அற்புதமான வான்வழி அனுபவத்திற்கு தயாராகுங்கள்!",
            "flight_details": "விமான விவரங்கள்",
            "payment_summary": "பணம் செலுத்தும் சுருக்கம்",
            "instructions": [
                "புறப்படுவதற்கு 30 நிமிடங்களுக்கு முன் ஹெலிபேடில் வந்து சேருங்கள்",
                "சரியான அரசு புகைப்பட அடையாள அட்டையை எடுத்துச் செல்லுங்கள் (ஆதார்/பாஸ்போர்ட்/DL)",
                "அதிகபட்ச சாமான்கள்: ஒரு பயணிக்கு 7 கிலோ",
                "வானிலை நிலைமைகள் விமான நேரத்தை பாதிக்கலாம்"
            ]
        },
        "gu": {
            "title": "બુકિંગ કન્ફર્મ!",
            "subtitle": "તમારી હેલિકોપ્ટર યાત્રા રાહ જોઈ રહી છે",
            "badge": "✅ કન્ફર્મ",
            "greeting": "તમારી હેલિકોપ્ટર બુકિંગ કન્ફર્મ થઈ ગઈ છે. એક અદ્ભુત હવાઈ અનુભવ માટે તૈયાર થાઓ!",
            "flight_details": "ફ્લાઇટ વિગતો",
            "payment_summary": "ચુકવણી સારાંશ",
            "instructions": [
                "કૃપા કરીને ઉપડતા 30 મિનિટ પહેલાં હેલિપેડ પર પહોંચો",
                "માન્ય સરકારી ફોટો ID લઈ જાઓ (આધાર/પાસપોર્ટ/DL)",
                "મહત્તમ સામાન: પ્રતિ મુસાફર 7 કિલો",
                "હવામાન પરિસ્થિતિઓ ફ્લાઇટના સમયને અસર કરી શકે છે"
            ]
        }
    },
    
    "flight_reminder": {
        "en": {
            "title": "Flight Tomorrow!",
            "subtitle": "Your flight is scheduled for tomorrow",
            "badge": "⏰ 24 HOURS TO GO",
            "greeting": "This is a friendly reminder that your helicopter flight is scheduled for tomorrow!",
            "flight_info": "Flight Information",
            "departure_location": "Departure Location",
            "checklist_title": "Pre-Flight Checklist",
            "checklist_items": [
                "Valid Government ID (Aadhaar/Passport/DL)",
                "Booking confirmation (this email or app)",
                "Arrive 30 minutes before departure",
                "Maximum baggage: 7 kg per person",
                "Wear comfortable clothing",
                "Check weather updates"
            ],
            "weather_advisory": "Weather Advisory: Flight operations are subject to weather conditions. In case of adverse weather, our team will contact you regarding rescheduling options."
        },
        "hi": {
            "title": "कल उड़ान है!",
            "subtitle": "आपकी उड़ान कल निर्धारित है",
            "badge": "⏰ 24 घंटे बाकी",
            "greeting": "यह एक मित्रवत अनुस्मारक है कि आपकी हेलीकॉप्टर उड़ान कल निर्धारित है!",
            "flight_info": "उड़ान जानकारी",
            "departure_location": "प्रस्थान स्थान",
            "checklist_title": "उड़ान पूर्व चेकलिस्ट",
            "checklist_items": [
                "वैध सरकारी आईडी (आधार/पासपोर्ट/DL)",
                "बुकिंग कन्फर्मेशन (यह ईमेल या ऐप)",
                "प्रस्थान से 30 मिनट पहले पहुंचें",
                "अधिकतम सामान: प्रति व्यक्ति 7 किग्रा",
                "आरामदायक कपड़े पहनें",
                "मौसम अपडेट जांचें"
            ],
            "weather_advisory": "मौसम सलाह: उड़ान संचालन मौसम की स्थिति पर निर्भर है। प्रतिकूल मौसम की स्थिति में, हमारी टीम पुनर्निर्धारण विकल्पों के बारे में आपसे संपर्क करेगी।"
        },
        "mr": {
            "title": "उद्या उड्डाण!",
            "subtitle": "तुमचे उड्डाण उद्यासाठी नियोजित आहे",
            "badge": "⏰ 24 तास बाकी",
            "greeting": "हे एक मैत्रीपूर्ण स्मरणपत्र आहे की तुमचे हेलिकॉप्टर उड्डाण उद्यासाठी नियोजित आहे!",
            "flight_info": "उड्डाण माहिती",
            "departure_location": "निघण्याचे ठिकाण",
            "checklist_title": "उड्डाणपूर्व चेकलिस्ट",
            "checklist_items": [
                "वैध सरकारी ओळखपत्र (आधार/पासपोर्ट/DL)",
                "बुकिंग पुष्टीकरण (हा ईमेल किंवा अ‍ॅप)",
                "निघण्यापूर्वी 30 मिनिटे आधी पोहोचा",
                "जास्तीत जास्त सामान: प्रति व्यक्ती 7 किलो",
                "आरामदायक कपडे घाला",
                "हवामान अपडेट तपासा"
            ],
            "weather_advisory": "हवामान सल्ला: उड्डाण कार्य हवामान स्थितीवर अवलंबून आहे. प्रतिकूल हवामानाच्या बाबतीत, आमची टीम पुनर्नियोजन पर्यायांबद्दल तुमच्याशी संपर्क साधेल."
        },
        "ta": {
            "title": "நாளை விமானம்!",
            "subtitle": "உங்கள் விமானம் நாளைக்கு திட்டமிடப்பட்டுள்ளது",
            "badge": "⏰ 24 மணி நேரம் மீதம்",
            "greeting": "உங்கள் ஹெலிகாப்டர் விமானம் நாளைக்கு திட்டமிடப்பட்டுள்ளது என்பதை நினைவூட்டுகிறோம்!",
            "flight_info": "விமான தகவல்",
            "departure_location": "புறப்படும் இடம்",
            "checklist_title": "பறப்புக்கு முந்தைய சரிபார்ப்பு பட்டியல்",
            "checklist_items": [
                "செல்லுபடியாகும் அரசு அடையாள அட்டை (ஆதார்/பாஸ்போர்ட்/DL)",
                "முன்பதிவு உறுதிப்படுத்தல் (இந்த மின்னஞ்சல் அல்லது ஆப்)",
                "புறப்படுவதற்கு 30 நிமிடங்களுக்கு முன் வாருங்கள்",
                "அதிகபட்ச சாமான்கள்: ஒருவருக்கு 7 கிலோ",
                "வசதியான ஆடைகளை அணியுங்கள்",
                "வானிலை புதுப்பிப்புகளைச் சரிபார்க்கவும்"
            ],
            "weather_advisory": "வானிலை ஆலோசனை: விமான செயல்பாடுகள் வானிலை நிலைமைகளுக்கு உட்பட்டவை. பாதகமான வானிலையின் போது, மறுதிட்டமிடல் விருப்பங்கள் குறித்து எங்கள் குழு உங்களைத் தொடர்பு கொள்ளும்."
        },
        "gu": {
            "title": "કાલે ફ્લાઇટ!",
            "subtitle": "તમારી ફ્લાઇટ કાલે માટે સુનિશ્ચિત છે",
            "badge": "⏰ 24 કલાક બાકી",
            "greeting": "આ એક મૈત્રીપૂર્ણ રિમાઇન્ડર છે કે તમારી હેલિકોપ્ટર ફ્લાઇટ કાલે માટે સુનિશ્ચિત છે!",
            "flight_info": "ફ્લાઇટ માહિતી",
            "departure_location": "ઉપડવાનું સ્થાન",
            "checklist_title": "ફ્લાઇટ પહેલાની ચેકલિસ્ટ",
            "checklist_items": [
                "માન્ય સરકારી ID (આધાર/પાસપોર્ટ/DL)",
                "બુકિંગ કન્ફર્મેશન (આ ઈમેલ અથવા એપ)",
                "ઉપડતા 30 મિનિટ પહેલાં પહોંચો",
                "મહત્તમ સામાન: વ્યક્તિ દીઠ 7 કિલો",
                "આરામદાયક કપડાં પહેરો",
                "હવામાન અપડેટ્સ તપાસો"
            ],
            "weather_advisory": "હવામાન સલાહ: ફ્લાઇટ કામગીરી હવામાનની સ્થિતિને આધિન છે. પ્રતિકૂળ હવામાનના કિસ્સામાં, અમારી ટીમ રિશેડ્યુલિંગ વિકલ્પો વિશે તમારો સંપર્ક કરશે."
        }
    },
    
    "flight_cancelled": {
        "en": {
            "title": "Flight Cancelled",
            "subtitle": "We're sorry for the inconvenience",
            "badge": "❌ CANCELLED",
            "greeting": "We regret to inform you that your flight has been cancelled. A refund has been initiated to your original payment method.",
            "cancelled_flight": "Cancelled Flight",
            "refund_details": "Refund Details",
            "apology": "We apologize for the inconvenience. As a token of appreciation for your understanding, we're offering you a 10% discount on your next booking.",
            "discount_code": "Use code SORRY10 at checkout."
        },
        "hi": {
            "title": "उड़ान रद्द",
            "subtitle": "असुविधा के लिए हमें खेद है",
            "badge": "❌ रद्द",
            "greeting": "हमें आपको सूचित करते हुए खेद है कि आपकी उड़ान रद्द कर दी गई है। आपके मूल भुगतान विधि पर रिफंड शुरू कर दिया गया है।",
            "cancelled_flight": "रद्द उड़ान",
            "refund_details": "रिफंड विवरण",
            "apology": "असुविधा के लिए हम क्षमा चाहते हैं। आपकी समझ के लिए धन्यवाद के रूप में, हम आपकी अगली बुकिंग पर 10% छूट प्रदान कर रहे हैं।",
            "discount_code": "चेकआउट पर कोड SORRY10 का उपयोग करें।"
        },
        "mr": {
            "title": "उड्डाण रद्द",
            "subtitle": "गैरसोयीबद्दल आम्हाला खेद वाटतो",
            "badge": "❌ रद्द",
            "greeting": "तुम्हाला कळवण्यात खेद वाटतो की तुमचे उड्डाण रद्द करण्यात आले आहे. तुमच्या मूळ पेमेंट पद्धतीवर रिफंड सुरू करण्यात आले आहे.",
            "cancelled_flight": "रद्द झालेले उड्डाण",
            "refund_details": "रिफंड तपशील",
            "apology": "गैरसोयीबद्दल आम्ही माफी मागतो. तुमच्या समजूतदारपणाबद्दल कृतज्ञता म्हणून, आम्ही तुम्हाला तुमच्या पुढील बुकिंगवर 10% सूट देत आहोत.",
            "discount_code": "चेकआउटवर कोड SORRY10 वापरा।"
        },
        "ta": {
            "title": "விமானம் ரத்து",
            "subtitle": "சிரமத்திற்கு மன்னிக்கவும்",
            "badge": "❌ ரத்து",
            "greeting": "உங்கள் விமானம் ரத்து செய்யப்பட்டது என்று தெரிவிக்க வருந்துகிறோம். உங்கள் அசல் பணம் செலுத்தும் முறைக்கு திரும்பப்பெறுதல் தொடங்கப்பட்டது.",
            "cancelled_flight": "ரத்து செய்யப்பட்ட விமானம்",
            "refund_details": "திரும்பப்பெறும் விவரங்கள்",
            "apology": "சிரமத்திற்கு மன்னிப்பு கோருகிறோம். உங்கள் புரிதலுக்கு நன்றி தெரிவிக்கும் விதமாக, உங்கள் அடுத்த முன்பதிவில் 10% தள்ளுபடி வழங்குகிறோம்.",
            "discount_code": "செக்அவுட்டில் SORRY10 குறியீட்டைப் பயன்படுத்துங்கள்."
        },
        "gu": {
            "title": "ફ્લાઇટ રદ",
            "subtitle": "અસુવિધા માટે અમને ખેદ છે",
            "badge": "❌ રદ",
            "greeting": "અમને તમને જણાવતાં દુઃખ થાય છે કે તમારી ફ્લાઇટ રદ કરવામાં આવી છે. તમારી મૂળ ચુકવણી પદ્ધતિ પર રિફંડ શરૂ કરવામાં આવ્યું છે.",
            "cancelled_flight": "રદ થયેલ ફ્લાઇટ",
            "refund_details": "રિફંડ વિગતો",
            "apology": "અસુવિધા માટે અમે માફી માગીએ છીએ. તમારી સમજણ માટે આભારના ટોકન તરીકે, અમે તમને તમારી આગામી બુકિંગ પર 10% ડિસ્કાઉન્ટ આપી રહ્યા છીએ.",
            "discount_code": "ચેકઆઉટ પર કોડ SORRY10 વાપરો."
        }
    },
    
    "otp": {
        "en": {
            "title": "Verification Code",
            "subtitle": "Secure your account",
            "badge": "🔐 OTP",
            "otp_message": "Use the following OTP for",
            "purposes": {
                "login": "logging into your account",
                "signup": "completing your registration",
                "reset_password": "resetting your password",
                "verify_email": "verifying your email address",
                "payment": "authorizing your payment"
            },
            "warning_items": [
                "Never share this OTP with anyone, including AirYatra staff",
                "AirYatra will never call and ask for your OTP",
                "If you didn't request this, please ignore this email"
            ]
        },
        "hi": {
            "title": "सत्यापन कोड",
            "subtitle": "अपना खाता सुरक्षित करें",
            "badge": "🔐 OTP",
            "otp_message": "निम्नलिखित OTP का उपयोग करें",
            "purposes": {
                "login": "अपने खाते में लॉगिन करने के लिए",
                "signup": "अपना पंजीकरण पूरा करने के लिए",
                "reset_password": "अपना पासवर्ड रीसेट करने के लिए",
                "verify_email": "अपना ईमेल पता सत्यापित करने के लिए",
                "payment": "अपने भुगतान को अधिकृत करने के लिए"
            },
            "warning_items": [
                "इस OTP को किसी के साथ साझा न करें, AirYatra स्टाफ सहित",
                "AirYatra कभी भी आपका OTP नहीं मांगेगा",
                "यदि आपने यह अनुरोध नहीं किया है, तो कृपया इस ईमेल को अनदेखा करें"
            ]
        },
        "mr": {
            "title": "पडताळणी कोड",
            "subtitle": "तुमचे खाते सुरक्षित करा",
            "badge": "🔐 OTP",
            "otp_message": "खालील OTP वापरा",
            "purposes": {
                "login": "तुमच्या खात्यात लॉगिन करण्यासाठी",
                "signup": "तुमची नोंदणी पूर्ण करण्यासाठी",
                "reset_password": "तुमचा पासवर्ड रीसेट करण्यासाठी",
                "verify_email": "तुमचा ईमेल पत्ता पडताळण्यासाठी",
                "payment": "तुमचे पेमेंट अधिकृत करण्यासाठी"
            },
            "warning_items": [
                "हा OTP कोणाशीही शेअर करू नका, AirYatra स्टाफसह",
                "AirYatra कधीही तुमचा OTP विचारणार नाही",
                "जर तुम्ही हे विनंती केली नसेल तर कृपया हा ईमेल दुर्लक्ष करा"
            ]
        },
        "ta": {
            "title": "சரிபார்ப்பு குறியீடு",
            "subtitle": "உங்கள் கணக்கைப் பாதுகாக்கவும்",
            "badge": "🔐 OTP",
            "otp_message": "பின்வரும் OTP-ஐப் பயன்படுத்தவும்",
            "purposes": {
                "login": "உங்கள் கணக்கில் உள்நுழைய",
                "signup": "உங்கள் பதிவை முடிக்க",
                "reset_password": "உங்கள் கடவுச்சொல்லை மீட்டமைக்க",
                "verify_email": "உங்கள் மின்னஞ்சல் முகவரியை சரிபார்க்க",
                "payment": "உங்கள் பணம் செலுத்துதலை அங்கீகரிக்க"
            },
            "warning_items": [
                "இந்த OTP-ஐ யாரிடமும் பகிர வேண்டாம், AirYatra ஊழியர்கள் உட்பட",
                "AirYatra ஒருபோதும் உங்கள் OTP-ஐ கேட்காது",
                "நீங்கள் இதைக் கோரவில்லை என்றால், இந்த மின்னஞ்சலை புறக்கணிக்கவும்"
            ]
        },
        "gu": {
            "title": "ચકાસણી કોડ",
            "subtitle": "તમારું એકાઉન્ટ સુરક્ષિત કરો",
            "badge": "🔐 OTP",
            "otp_message": "નીચેના OTP નો ઉપયોગ કરો",
            "purposes": {
                "login": "તમારા એકાઉન્ટમાં લૉગિન કરવા માટે",
                "signup": "તમારી નોંધણી પૂર્ણ કરવા માટે",
                "reset_password": "તમારો પાસવર્ડ રીસેટ કરવા માટે",
                "verify_email": "તમારું ઈમેલ સરનામું ચકાસવા માટે",
                "payment": "તમારી ચુકવણી અધિકૃત કરવા માટે"
            },
            "warning_items": [
                "આ OTP કોઈની સાથે શેર કરશો નહીં, AirYatra સ્ટાફ સહિત",
                "AirYatra ક્યારેય તમારો OTP નહીં માંગે",
                "જો તમે આ વિનંતી કરી નથી, તો કૃપા કરીને આ ઈમેલને અવગણો"
            ]
        }
    }
}


# ==================== HELPER FUNCTIONS ====================

def get_translation(lang: str, key: str, default: str = None) -> str:
    """Get a common translation string"""
    lang_strings = COMMON_STRINGS.get(lang, COMMON_STRINGS["en"])
    return lang_strings.get(key, default or COMMON_STRINGS["en"].get(key, key))


def get_email_translation(template_name: str, lang: str, key: str = None) -> Dict[str, Any]:
    """Get email-specific translations"""
    template_translations = EMAIL_TRANSLATIONS.get(template_name, {})
    lang_content = template_translations.get(lang, template_translations.get("en", {}))
    
    if key:
        return lang_content.get(key)
    return lang_content


def get_supported_languages() -> Dict[str, Dict]:
    """Get list of supported languages"""
    return SUPPORTED_LANGUAGES


def detect_user_language(user_preferences: Dict = None, default: str = "en") -> str:
    """Detect user's preferred language"""
    if user_preferences and user_preferences.get("language"):
        lang = user_preferences["language"]
        if lang in SUPPORTED_LANGUAGES:
            return lang
    return default
