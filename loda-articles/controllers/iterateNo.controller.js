var elasticsearch = require('elasticsearch');
var striptags = require('striptags');
var Promise = require("bluebird");

var elasticClient = new elasticsearch.Client({
    host: 'localhost:9200',
    log: [{
        type: 'stdio',
        levels: ['error'] // change these options
    }],
});

//require('events').EventEmitter.defaultMaxListeners = 0;
//process.setMaxListeners(0);

const DilaApiClient = require("@socialgouv/dila-api-client");
const dilaApi = new DilaApiClient();

function iterateSection(response2,lawCid,lawId, lawTitle, lawVisa, lawSignature, completeArray,subsection = []){

    if (response2.articles && response2.articles.length > 0) {
        var toPop = 0;
        if (subsection.length === 0){
            subsection.push({
                title: '',
                cid: '',
                id: ''
            });
            toPop = 1;
        }
        response2.articles.forEach(articleDecree => {
            completeArray = createInputArray(articleDecree, lawCid,lawId, lawTitle, lawVisa, lawSignature, subsection, completeArray);
        });
        if(toPop){
            subsection.pop();
        }
    }

    if (response2.sections && response2.sections.length > 0) {
        response2.sections.forEach(lawSection => {
            subsection.push(lawSection);
            if (lawSection.sections && lawSection.sections.length > 0){
                iterateSection(lawSection,lawCid,lawId, lawTitle, lawVisa, lawSignature, completeArray, subsection)
            }
            if (lawSection.articles.length > 0) {
                lawSection.articles.forEach(articleDecree => {
                    completeArray = createInputArray(articleDecree, lawCid,lawId, lawTitle, lawVisa, lawSignature, subsection, completeArray);
                });
                subsection.pop();
            }
        })
    } 

    return completeArray;
}


function createInputArray(articleDecree, lawCid,lawId, lawTitle, lawVisa, lawSignature, lawSections, completeArray) {
    completeArray.push({
        "index": {
            "_index": "iteration",
            "_id": articleDecree.id,
            "_type": "test",
        }
    });
    
    var sectionTitle = '';
    var sectionCid = '';
    var sectionId = '';

    lawSections.forEach(function(lawSection, idx, array) {
        sectionTitle += lawSection.title;
        sectionCid += lawSection.cid;
        sectionId += lawSection.id;
        if(idx !== array.length - 1){
            sectionTitle += ' &gt; ';
            sectionCid += ' &gt; ';
            sectionId += ' &gt; ';
        }
    });

    completeArray.push({
        lawId: lawId,
        lawcid: lawCid,
        lawTitle: lawTitle,
        lawVisa: lawVisa,
        lawSignature: lawSignature,
        sectionTitle: sectionTitle,
        sectionCid: sectionCid,
        sectionid: sectionId,
        article: {
            id: articleDecree.id,
            cid: articleDecree.cid,
            num: articleDecree.num,
            content: striptags(articleDecree.content),
            type: articleDecree.type,
            etat: articleDecree.etat,
            lstLienModification: articleDecree.lstLienModification,
            lstLienCitation: articleDecree.lstLienCitation,
        }
    });
    return completeArray;
}

async function makeBulk(completeArray) {
    try {
        const response = await elasticClient.bulk({
            refresh: true,
            body: completeArray
        });
        console.log(response)
        return [];
    } catch (err) {
        console.error(err)
    }
}

async function launchMe(dateEnd, dateStart, number){
    // var dateEnd = ['1994-12-31','2004-12-31','2011-12-31','2018-12-31','2019-12-31'];
    // var dateStart = ['1900-01-01','1995-01-01','2005-01-01','2012-01-01','2019-01-01'];
    var count = 0;
    //var completeArray = [];

    for (var t = 0; t < 1; t++) {
        let response0 = await dilaApi.fetch({
            path: "list/loda",
            method: "POST",
            params: {
                "legalStatus": [
                    "VIGUEUR",
                    "VIGUEUR_DIFF"
                ],
                "natures": [
                    "LOI",
                    "ORDONNANCE",
                    "DECRET"
                ],
                "pageNumber": 1,
                "pageSize": 100,
                "publicationDate": {
                    "end": dateEnd[t],
                    "start": dateStart[t]
                },
                "signatureDate": {
                    "end": dateEnd[t],
                    "start": dateStart[t]
                },
                "sort": "DATE_PUBLI_ASC"
            }
        }).catch(e => {
            console.log('Erreur API 1')
            console.log(e);
        });
        //console.log(z);
        var timeToIterate = Math.ceil(response0.totalResultNumber / 100);
        for (var i = 1; i <= timeToIterate; i++) {
            // if(i%10 == 0 || i == timeToIterate){
            //     console.log('i is :' +i);
            // }
            var completeArray = [];
            let response = await dilaApi.fetch({
                path: "list/loda",
                method: "POST",
                params: {
                    "legalStatus": [
                        "VIGUEUR",
                        "VIGUEUR_DIFF"
                    ],
                    "natures": [
                        "LOI",
                        "ORDONNANCE",
                        "DECRET"
                    ],
                    "pageNumber": i,
                    "pageSize": 100,
                    "publicationDate": {
                        "end": dateEnd[t],
                        "start": dateStart[t]
                    },
                    "signatureDate": {
                        "end": dateEnd[t],
                        "start": dateStart[t]
                    },
                    "sort": "DATE_PUBLI_ASC"
                }
            }).catch(e => {
                console.log('Erreur API 2')
                console.log(e);
            });
            //console.log(response);

            await Promise.map(response.results, async x => {
                let response2 = await dilaApi.fetch({
                    path: "consult/lawDecree",
                    method: "POST",
                    params: {
                        "date": x.lastUpdate,
                        "textId": x.cid
                    }
                }).catch(e => {
                    console.log('Erreur API 3')
                    console.log(e);
                });

                if (!response2) {
                    console.log('API 4 cause failure of 3')
                    response2 = await dilaApi.fetch({
                        path: "consult/lawDecree",
                        method: "POST",
                        params: {
                            "date": x.dateDebut,
                            "textId": x.cid
                        }
                    }).catch(e => {
                        console.log('Erreur API 4')
                        console.log(e);
                    });
                }
                let lawId = response2.id;
                let lawCid = response2.cid;
                let lawTitle = response2.title;
                let lawVisa = striptags(response2.visa);
                let lawSignature = striptags(response2.signers);
                completeArray = iterateSection(response2,lawCid,lawId, lawTitle, lawVisa, lawSignature, completeArray);
                //console.log(completeArray.length);
            });

            console.log(' number is :'+ number +' itaration is :' + i +'/ '+ timeToIterate +' array is :' + completeArray.length / 2);
            elasticClient.bulk({
                    refresh: "true",
                    body: completeArray
                },
                function (err, response) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    //console.log(`Inside bulk3...`);
                    let errorCount = 0;
                    response.items.forEach(item => {
                        if (item.index && item.index.error) {
                            //console.log(++errorCount, item.index.error);
                        }
                    });
                    //console.log(`Successfully indexed items`);
                }
            )
        }
    }
}

module.exports = {
    first: async function (req, res) {
        launchMe(['1950-12-31'],['1500-01-01'],0);
        launchMe(['1960-12-31'],['1951-01-01'],1);
        launchMe(['1970-12-31'],['1961-01-01'],2);
        launchMe(['1976-12-31'],['1971-01-01'],3);
        launchMe(['1980-12-31'],['1977-01-01'],4);

    },

    test: async function (req, res) {
        for (i=1981;i<=1990;i++){
            launchMe([(i)+'-12-31'],[i+'-01-01'],i);
        }

    },

    // [xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx]
};