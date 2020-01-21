const pTimeout = require("p-timeout");
const debug = require("debug")("@socialgouv/legi-data:getArticle");

const MAX_TIMEOUT = 10000;
const MAX_TENTATIVES = 10;

var elasticsearch = require("elasticsearch");
var elasticClient = new elasticsearch.Client({
  host: "localhost:9210",
  log: [
    {
      type: "stdio",
      levels: ["error"] // change these options
    }
  ]
});

const getArticle = (dilaClient, id, tries = 0) =>
  pTimeout(
    dilaClient.fetch({
      path: "consult/getArticle",
      method: "POST",
      params: {
        id
      }
    }),
    MAX_TIMEOUT,
    e => {
      debug(`timed out ${id}`);
      throw e;
    }
  )
    .then(data => {
      if (data.article) {
        debug(`getArticle ${id} OK`);
        elasticClient
          .index({
            index: "code",
            type: "code",
            id: data.article.id,
            body: data.article
          })
          .then(
            function() {},
            function() {
              throw new Error(`Cant get article ${id} (${tries + 1})`);
            }
          )
          .catch(e => {
            if (tries < MAX_TENTATIVES) {
              //debug(`getArticle ${id} ${tries + 2}/${MAX_TENTATIVES}`);
              return getArticle(dilaClient, id, tries + 1);
            }
            console.log(e);
            throw e;
          });

        return data.article;
      }
      throw new Error(`Cant get article ${id} (${tries + 1})`);
    })
    // retry
    .catch(e => {
      if (tries < MAX_TENTATIVES) {
        //debug(`getArticle ${id} ${tries + 2}/${MAX_TENTATIVES}`);
        return getArticle(dilaClient, id, tries + 1);
      }
      console.log(e);
      throw e;
    });

module.exports = getArticle;
