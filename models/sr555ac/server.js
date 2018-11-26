const config = require('./config.json');
const request = require('request');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const Influx = require('influx');
const moment = require('moment');

const influx = new Influx.InfluxDB({
 host: config.influxdb.host,
 port: config.influxdb.port,
 database: 'dsl',
 schema: [
   {
     measurement: 'line',
     fields: {
		downstreamSnr: Influx.FieldType.FLOAT,
		upstreamSnr: Influx.FieldType.FLOAT,
		
		downstreamAttenuation: Influx.FieldType.FLOAT,
		upstreamAttentuation: Influx.FieldType.FLOAT,
		
		downstreamPower: Influx.FieldType.FLOAT,
		upstreamPower: Influx.FieldType.FLOAT,
		
		downstreamAttainableRate: Influx.FieldType.INTEGER,
		upstreamAttainableRate: Influx.FieldType.INTEGER,
		
		downstreamRate: Influx.FieldType.INTEGER,
		upstreamRate: Influx.FieldType.INTEGER
     },
     tags: [
       'id'
     ]
   }
 ]
});

influx.getDatabaseNames()
  .then(names => {
    if (!names.includes('dsl')) {
      return influx.createDatabase('dsl');
    }
  })
  .then(() => {
	  console.log("Connected to InfluxDB.");
  })
  .catch(err => {
    console.error(`Error creating Influx database! ` + err);
  })

var buffer = [];


function getUtcOffset(date) {
  return moment(date).utc()
}
// Makes one request and fills buffer variable with 1 data point
function makeRequest(line) {
	request('http://' + config.modem.username + ':' + config.modem.password + '@' + config.modem.host + '/admin/statsadsl.cgi?bondingLineNum=' + line, { }, (err, res, body) => {
		if (err) {
			console.log("Problem getting data from SR555AC " + err);
			return;
		}
		
		if (res.statusCode / 100 != 2) {
			console.log("Unexpected response code: " + res.statusCode);
			return;
		}
		
		const dom = new JSDOM(body);
		
		var dataPoint = {
			"measurement": "adsl",
			"tags": { "id": line },
			"fields": {
					"downstreamSnr": parseInt(dom.window.document.querySelector("body > blockquote > form > table > tbody > tr:nth-child(12) > td:nth-child(2)").textContent.trim()) / 10,
					"upstreamSnr": parseInt(dom.window.document.querySelector("body > blockquote > form > table > tbody > tr:nth-child(12) > td:nth-child(3)").textContent.trim()) / 10,
					"downstreamAttenuation": parseInt(dom.window.document.querySelector("body > blockquote > form > table > tbody > tr:nth-child(13) > td:nth-child(2)").textContent.trim()) / 10,
					"upstreamAttenuation": parseInt(dom.window.document.querySelector("body > blockquote > form > table > tbody > tr:nth-child(13) > td:nth-child(3)").textContent.trim()) / 10,
					"downstreamPower": parseInt(dom.window.document.querySelector("body > blockquote > form > table > tbody > tr:nth-child(14) > td:nth-child(2)").textContent.trim()) / 10,
					"upstreamPower": parseInt(dom.window.document.querySelector("body > blockquote > form > table > tbody > tr:nth-child(14) > td:nth-child(3)").textContent.trim()) / 10,
					"downstreamAttainableRate": parseInt(dom.window.document.querySelector("body > blockquote > form > table > tbody > tr:nth-child(15) > td:nth-child(2)").textContent.trim()),
					"upstreamAttainableRate": parseInt(dom.window.document.querySelector("body > blockquote > form > table > tbody > tr:nth-child(15) > td:nth-child(3)").textContent.trim()),
					"downstreamRate": parseInt(dom.window.document.querySelector("body > blockquote > form > table > tbody > tr:nth-child(19) > td:nth-child(2)").textContent.trim()),
					"upstreamRate": parseInt(dom.window.document.querySelector("body > blockquote > form > table > tbody > tr:nth-child(19) > td:nth-child(3)").textContent.trim())
			},
			"timestamp": new Date(getUtcOffset(new Date()))
		};
		
		buffer.push(dataPoint);
	});
	
	setTimeout(() => makeRequest(line), 15000);
}

function sendBuffer() {
	var bufferCopy = buffer.slice();
	var influxDataPoints = [];
	
	bufferCopy.forEach(function(dataPoint, index) {
		influxDataPoints.push(dataPoint);
		
		if (influxDataPoints.length > 0) {
			influx.writePoints(influxDataPoints).then(() => {
				console.log("Wrote data to InfluxDB");
				buffer.splice(index, 1);
			}).catch((err) => {
				console.log(err);
			});
		}
	});
	
	
	
	setTimeout(sendBuffer, 5000);
}

makeRequest(0);
makeRequest(1);

sendBuffer();