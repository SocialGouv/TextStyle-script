var elasticsearch = require('elasticsearch');
var striptags = require('striptags');
var Promise = require("bluebird");

const MAX_TENTATIVES = 20;

var elasticClient = new elasticsearch.Client({
    host: 'localhost:9200',
    log: [{
        type: 'stdio',
        levels: ['error'] // change these options
    }],
});

require('events').EventEmitter.defaultMaxListeners = 0;
process.setMaxListeners(0);

const DilaApiClient = require("@socialgouv/dila-api-client");
const dilaApi = new DilaApiClient();


function createInputArray(articleDecree, lawCid, lawTitle, lawVisa, lawSignature, lawSection, completeArray) {
    completeArray.push({
        "index": {
            "_index": "loda",
            "_id": articleDecree.id,
            "_type": "test",
        }
    });
    completeArray.push({
        lawcid: lawCid,
        lawTitle: lawTitle,
        lawVisa: lawVisa,
        lawSignature: lawSignature,
        sectionTitle: lawSection.title,
        sectionCid: lawSection.cid,
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

module.exports = {
    test: async function (req, res) {
        var dateEnd = ['1994-12-31', '2004-12-31', '2011-12-31', '2018-12-31', '2019-12-31'];
        var dateStart = ['1900-01-01', '1995-01-01', '2005-01-01', '2012-01-01', '2019-01-01'];
        var count = 0;
        //var completeArray = [];

        for (var t = 0; t < 5; t++) {
            console.log('t is '+ t);
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
            });
            //console.log(z);
            var timeToIterate = Math.ceil(response0.totalResultNumber / 100);
            console.log('iterate is :' + timeToIterate);
            for (var i = 1; i <= timeToIterate; i++) {
                if(i%10 == 0 || i == timeToIterate){
                    console.log('i is :' +i);
                }
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
                        //console.log(e);
                    });

                    if (!response2) {
                        response2 = await dilaApi.fetch({
                            path: "consult/lawDecree",
                            method: "POST",
                            params: {
                                "date": x.dateDebut,
                                "textId": x.cid
                            }
                        }).catch(e => {
                            //console.log(e);
                        });
                    }
                    let lawCid = response2.cid;
                    let lawTitle = response2.title;
                    let lawVisa = striptags(response2.visa);
                    let lawSignature = striptags(response2.signers);

                    if (response2.sections && response2.sections.length > 0) {
                        response2.sections.forEach(lawSection => {
                            if (lawSection.articles.length > 0) {
                                lawSection.articles.forEach(articleDecree => {
                                    count++;
                                    //console.log(count);
                                    //elasticIndexLoda(articleDecree,lawCid,lawTitle,lawVisa,lawSignature,lawSection);
                                    completeArray = createInputArray(articleDecree, lawCid, lawTitle, lawVisa, lawSignature, lawSection, completeArray);
                                });
                            }
                        })
                    }  if (response2.articles && response2.articles.length > 0) {
                        response2.articles.forEach(articleDecree => {
                            count++;
                            //console.log(count);
                            var lawSection = {
                                sectionTitle: null,
                                sectionCid: null
                            }
                            //elasticIndexLoda(articleDecree,lawCid,lawTitle,lawVisa,lawSignature,lawSection);
                            completeArray = createInputArray(articleDecree, lawCid, lawTitle, lawVisa, lawSignature, lawSection, completeArray);
                        });
                    }
                });

                //console.log('maintenant ' + completeArray.length / 2);
                // completeArray = await makeBulk(completeArray);

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
    },

    // [xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx]
};