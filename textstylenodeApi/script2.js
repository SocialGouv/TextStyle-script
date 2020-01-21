require('./config/config');
var elasticsearch = require('elasticsearch');
var striptags = require('striptags');
var Promise = require("bluebird");

var elasticClient = new elasticsearch.Client({
    host: 'localhost:9210',
    log: [{
        type: 'stdio',
        levels: ['error'] // change these options
    }],
});

require('events').EventEmitter.defaultMaxListeners = 0;
process.setMaxListeners(0);

const DilaApiClient = require("@socialgouv/dila-api-client");
const dilaApi = new DilaApiClient();

function iterateSection(response2, lawCid, lawId, lawTitle, lawVisa, lawSignature, completeArray, subsection = []) {

    if (response2.articles && response2.articles.length > 0) {
        var toPop = 0;
        if (subsection.length === 0) {
            subsection.push({
                title: '',
                cid: '',
                id: ''
            });
            toPop = 1;
        }
        response2.articles.forEach(articleDecree => {
            completeArray = createInputArray(articleDecree, lawCid, lawId, lawTitle, lawVisa, lawSignature, subsection, completeArray);
        });
        if (toPop) {
            subsection.pop();
        }
    }

    if (response2.sections && response2.sections.length > 0) {
        response2.sections.forEach(lawSection => {
            subsection.push(lawSection);
            if (lawSection.sections && lawSection.sections.length > 0) {
                iterateSection(lawSection, lawCid, lawId, lawTitle, lawVisa, lawSignature, completeArray, subsection)
            }
            if (lawSection.articles.length > 0) {
                lawSection.articles.forEach(articleDecree => {
                    completeArray = createInputArray(articleDecree, lawCid, lawId, lawTitle, lawVisa, lawSignature, subsection, completeArray);
                });
                subsection.pop();
            }
        })
    }

    return completeArray;
}


function createInputArray(articleDecree, lawCid, lawId, lawTitle, lawVisa, lawSignature, lawSections, completeArray) {
    completeArray.push({
        "index": {
            "_index": "testi",
            "_id": articleDecree.id,
            "_type": "test",
        }
    });

    var sectionTitle = '';
    var sectionCid = '';
    var sectionId = '';

    lawSections.forEach(function (lawSection, idx, array) {
        sectionTitle += lawSection.title;
        sectionCid += lawSection.cid;
        sectionId += lawSection.id;
        if (idx !== array.length - 1) {
            sectionTitle += ' &gt; ';
            sectionCid += ' &gt; ';
            sectionId += ' &gt; ';
        }
    });

    completeArray.push({
        lawId: lawId,
        lawcid: lawCid,
        lawTitle: lawTitle,
        lawType: 'loi',
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

async function launchMe(dateEnd, dateStart, number) {
    
    var completeArray = [];

        let response2 = await  dilaApi.fetch({
            path: "consult/jorf",
            method: "POST",
            params: {
                "textCid": "JORFTEXT000036298548"
              }
        }).catch(e => {
            //console.log('Erreur API 3')
        });

        let lawId = response2.id;
        let lawCid = response2.cid;
        let lawTitle = response2.title;
        let lawVisa = striptags(response2.visa);
        let lawSignature = striptags(response2.signers);
        completeArray = iterateSection(response2, lawCid, lawId, lawTitle, lawVisa, lawSignature, completeArray);
        //console.log(completeArray.length);


    console.log(completeArray.length / 2);
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

async function run() {
    console.log('Start running');
    launchMe();
    // var arg = [];
    // process.argv.forEach(function (val, index, array) {
    //     arg[index] = val;
    // });

    // if (arg[2] && arg[2] == 'first') {
    //      launchMe(['1950-12-31'], ['1500-01-01'], '1500-1950');
    //      launchMe(['1960-12-31'], ['1951-01-01'], '1951-1960');
    //      launchMe(['1970-12-31'], ['1961-01-01'], '1961-1970');
    //      launchMe(['1976-12-31'], ['1971-01-01'], '1971-1976');
    //      launchMe(['1980-12-31'], ['1977-01-01'], '1977-1980');
    // }
    // else if (arg[2] && arg[2] == 'date' && arg[3] && arg[4] && arg[3] <= arg[4]) {
    //     for (i = arg[3]; i <= arg[4]; i++) {
    //         if(arg[5] && arg[5] == 'begin'){
    //              launchMe([(i) + '-06-15'], [i + '-01-01'], i);
    //         }
    //         else if (arg[5] && arg[5] == 'end'){
    //              launchMe([(i) + '-12-31'], [i + '-06-16'], i);
    //         }
    //         else{
    //              launchMe([(i) + '-12-31'], [i + '-01-01'], i);
    //         }
    //     }
    // }
    // else{
    //     console.log('Error in Argument')
    // }
};

run();