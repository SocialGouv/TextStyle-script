var elasticsearch = require('elasticsearch');
var striptags = require('striptags');

const MAX_TENTATIVES = 20;

var elasticClient = new elasticsearch.Client({
    host: 'localhost:9200',
    log : [{
        type: 'stdio',
        levels: ['error'] // change these options
      }],
});

require('events').EventEmitter.defaultMaxListeners = 0;
process.setMaxListeners(0);

const DilaApiClient = require("@socialgouv/dila-api-client");
const dilaApi = new DilaApiClient();

module.exports = {

    dilaSearchLegi: function (req, res) {


        dilaApi.fetch({
                path: "search",
                method: "POST",
                params: {
                        "fond": "LODA_DATE",
                        "recherche": {
                          "champs": [
                          {
                            "criteres": [
                              {
                                "operateur": "ET",
                                "proximite": 2,
                                "typeRecherche": "UN_DES_MOTS",
                                "valeur": "*"
                              }
                            ],
                            "operateur": "ET",
                            "typeChamp": "TITLE"
                          }
                        ],
                          "filtres": [
                          ],
                          "operateur": "ET",
                          "pageNumber": 1,
                          "pageSize": 10,
                          "sort": "SIGNATURE_DATE_DESC",
                          "typePagination": "DEFAUT"
                        }
                      }
            })
            .then(function (responseJson) {
                return res.json(responseJson)
            });
    },

    dilaSearchJorf: function (req, res) {

       

        dilaApi.fetch({
                path: "consult/jorf",
                method: "POST",
                params: {
                    "textCid": "JORFTEXT000036298548"
                  }
            })
            .then(function (responseJson) {
                return res.json(responseJson)
            });
    },

    dilaSearchLoda: function (req, res) {

       

        dilaApi.fetch({
                path: "list/loda",
                method: "POST",
                params: {
                    "legalStatus": [
                      "VIGUEUR",
                      "VIGUEUR_DIFF"
                    ],
                    "natures": [
                      "LOI",
                    ],
                    "pageNumber": 1,
                    "pageSize": 100,
                    "publicationDate": {
                      "end": "1980-12-31",
                      "start": "1500-01-01"
                    },
                    "signatureDate": {
                      "end": "1980-12-31",
                      "start": "1500-01-01"
                    },
                    "sort": "DATE_PUBLI_ASC"
                  }
            })
            .then(function (responseJson) {
                return res.json(responseJson)
            });
    },

    // [xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx]
};