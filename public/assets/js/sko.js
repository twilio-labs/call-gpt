var sessionId = '';
function getAllTranscripts() {
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
        }
    };
    let uri = "/getAllTranscripts";
    fetch(uri, options)
        .then(response => response.json())
        .then(response => processReponse(response, 'alltranscript'))
        .catch(err => console.error(err));
}

function getTranscriptById(id) {
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
        }
    };
    let uri = "/getTranscriptById?id=" + id;
    fetch(uri, options)
        .then(response => response.json())
        .then(response => processReponse(response, 'transcriptid'))
        .catch(err => console.error(err));
}

function getSessionId() {
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
        }
    };
    let uri = "/getSessionId";
    fetch(uri, options)
        .then(response => response.json())
        .then(response => processReponse(response, 'sessionid'))
        .catch(err => console.error(err));
}

function processReponse(data, type) {
    if (type === "alltranscript") {
        document.getElementById('history').innerHTML = '';
        let conlist = '';
        let msgbody = '';
        //console.log(data);
        const arr = Object.entries(data);
        
        for (let i = 0; i < arr.length; i++) { 
            let conId = arr[i][1].conversationId;
            conlist = '<div class="accordion-item"><h2 class="accordion-header" id="heading' + i + '"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse' + i + '" aria-expanded="false" aria-controls="collapseTwo">' + conId + ' </button> </h2><div id="collapse' + i + '" class="accordion-collapse collapse" aria-labelledby="heading' + i +'" data-bs-parent="#accordionExample"> <div id="msgbody-' + i + '" class="accordion-body"></div></div></div>'
            document.getElementById('history').innerHTML += conlist;
            const arr2 = Object.entries(arr[i][1].transcript);
            msgbody = '';
            //let lng = arr2.length;
            //conlist += arr[i][1].conversationId + "<br>";
            for (let x = 0; x < arr2.length; x++) {
                
                msgbody += arr2[x][1].body;
            }
            
            document.getElementById('msgbody-' + i).innerHTML = msgbody;
           
            
        }
      
        
    } else if (type === 'transcriptid') {
        alert("Success by ID")
    } else if (type === 'sessionid') {
        sessionId = data[0].id;
    }
}

//11ee566c-880d-4708-8261-c95f947e0faf
getSessionId();