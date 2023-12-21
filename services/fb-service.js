
const EventEmitter = require("events");

var fb = require("firebase-admin");


var serviceAccount = require("../firebase-db.json");
const firebaseConfig = {
    credential: fb.credential.cert(serviceAccount),
    apiKey: "AIzaSyBTsjJwRelnAAh1x0URdF0UgUTBz4Pj8vM",
    authDomain: "twilio-hackathon-sko-2024.firebaseapp.com",
    databaseURL: "https://twilio-hackathon-sko-2024-default-rtdb.firebaseio.com",
    projectId: "twilio-hackathon-sko-2024",
    storageBucket: "twilio-hackathon-sko-2024.appspot.com",
    messagingSenderId: "888116972091",
    appId: "1:888116972091:web:90c2705639e9f330b96a1e",
    measurementId: "G-KLLK96FJCB"
};

// Initialize Firebase
fb.initializeApp(firebaseConfig);

global.fbtranscriptcount = 0;
class FirebaseService extends EventEmitter {
    constructor() {
        super();
    }

    async setTranscript(data, id, conId, type) {
        fbtranscriptcount++;
        if (data) {
            //let ndate = Date();
            let dateObj = new Date(); 
            let md = dateObj.toDateString() + " | " + dateObj.toTimeString();
            //check if record is saved
            //const record = await fb.database().ref(conId);
            // Attach an asynchronous callback to read the data at our posts reference
            if (fbtranscriptcount > 1) {
                
                var postListRef = fb.database().ref('transcripts/' + conId + '/transcript');
                var newPostRef = postListRef.push();
                newPostRef.set({
                    id: id,
                    body: data,
                    datetime: fb.database.ServerValue.TIMESTAMP,
                    type: type
                });
            } else {
                const res = await fb.database().ref('transcripts/' + conId).set({
                    conversationId: conId,
                    //transcript: data,

                    status: 'active',
                    datetime: fb.database.ServerValue.TIMESTAMP,
                    metadata: md,
                    transcript: [
                        {
                            id: id,
                            body: data,
                            datetime: fb.database.ServerValue.TIMESTAMP,
                            type: type
                        }
                    ]

                });
            }

         
        }
        
    }

    async getTranscriptById(id) {
        var transcript = fb.database().ref('transcripts/' + id);
        return transcript;
      
    }

    async getAllTranscripts() {
        let snap;
        //Get last ten records inserted by datetime 
        var allTranscripts = await fb.database().ref('transcripts').orderByChild('datetime').limitToLast(10);
        return await allTranscripts.once('value').then(function (snapshot) {
            console.log(snapshot.val())
            snap = snapshot.val();
            return snap;
        })
       
    }
}

module.exports = { FirebaseService };
