const config = require('./config.json');
const request = require('request');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const Influx = require('influx');
const moment = require('moment');

const influx = new Influx.InfluxDB({
 host: config.influxdb.host,
 port: config.influxdb.port,
 database: 'modem',
 schema: [
   {
     measurement: 'downstream',
     fields: {
		power: Influx.FieldType.FLOAT,
		snr: Influx.FieldType.FLOAT,	
		noise: Influx.FieldType.FLOAT,
		corrected: Influx.FieldType.INTEGER,
		uncorrected: Influx.FieldType.INTEGER
     },
     tags: [
       'channelId', 'frequency'
     ]
   },
   {
     measurement: 'upstream',
     fields: {
		power: Influx.FieldType.FLOAT,
		symbolRate: Influx.FieldType.FLOAT,
     },
     tags: [
       'channelId', 'frequency'
     ]
   },
   {
     measurement: 'downstreamBonded',
     fields: {
		number: Influx.FieldType.INTEGER
     },
     tags: []
   },
   {
     measurement: 'upstreamBonded',
     fields: {
		number: Influx.FieldType.INTEGER
     },
     tags: []
   }
 ]
});

influx.getDatabaseNames()
  .then(names => {
    if (!names.includes('modem')) {
      return influx.createDatabase('modem');
    }
  })
  .then(() => {
	  console.log("Connected to InfluxDB.");
  })
  .catch(err => {
    console.error(`Error creating Influx database! ` + err);
  })

var buffer = [];

/* MOTOROLA MB8600 */
var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function encode(Str)
{
   Str = escape(Str);
   var output = "";
   var chr1, chr2, chr3 = "";
   var enc1, enc2, enc3, enc4 = "";
   var i = 0;

   do {
      chr1 = Str.charCodeAt(i++);
      chr2 = Str.charCodeAt(i++);
      chr3 = Str.charCodeAt(i++);
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
      if (isNaN(chr2))
      {
         enc3 = enc4 = 64;
      }
      else if (isNaN(chr3))
      {
         enc4 = 64;
      }   
      output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4);
      chr1 = chr2 = chr3 = "";
      enc1 = enc2 = enc3 = enc4 = "";
   } while (i < Str.length);
   
   return output;   
}   

function getUtcOffset(date) {
  return moment(date).utc()
}

// Makes one request and fills buffer variable with 1 data point
function makeRequest() {
	request('http://' + config.modem.host + '/MotoConnection.html', { }, (err, res, body) => {
		if (err) {
			console.log("Problem getting data from MB8600: " + err);
			return;
		}
		
		if (body.indexOf("parent.location='login.html'") > -1) {
			console.warn("Logging into modem...");
			
			var encodedPassword = encode(config.modem.password);
			
			request({
				uri: `http://${config.modem.host}/login_auth.html?loginUsername=${config.modem.username}&loginPassword=${encodedPassword}&`,
				headers: {
					'Referer': `http://${config.modem.host}/login.html`,
					'Cookie': 'Name=',
					'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36"
				}
			}, (err, res, body) => {
				if (err)
					console.warn(err);
			});
			return;
		}
		
		const dom = new JSDOM(body);
		
		var sections = dom.window.document.querySelectorAll("table.moto-table-title");
		var downstreamChannels = [];
		var upstreamChannels = [];
			
		sections.forEach(function(table) {
			var sectionName = table.querySelector("td.moto-param-title").textContent.trim();
			var contentTable = table.querySelector("table.moto-table-content");
			
			// We need to check login here?
			
			//Startup Sequence
			
			//Connection Status
			
			//Downstream Bonded Channels
			if (sectionName == "Downstream Bonded Channels") {
				// Get headers
				var headers = contentTable.querySelectorAll("td.moto-param-header-s");
				var headerColumnMappings = [];
				var headerNameMappings = [];
				headers.forEach(function (header, index) {
					headerNameMappings[index] = header.textContent.trim();
					headerColumnMappings[header.textContent.trim()] = index;
				});
				
				// Get rows (channels)
				var rows = contentTable.querySelectorAll("tr:not(:first-child)");
				
				rows.forEach(function(channel, rowIndex) {
					var columns = channel.querySelectorAll("td");
					
					// Ensure channel is locked
					var lockStatus = columns[headerColumnMappings["Lock Status"]].textContent.trim();
					if (lockStatus != "Locked") return;
				
					// Parse columns
					var channelId = parseInt(columns[headerColumnMappings["Channel ID"]].textContent) || 0;
					var frequency = (parseFloat(columns[headerColumnMappings["Freq. (MHz)"]].textContent) * 1000000) || 0;
					var power = parseFloat(columns[headerColumnMappings["Pwr (dBmV)"]].textContent) || 0;
					var snr = parseFloat(columns[headerColumnMappings["SNR (dB)"]].textContent) || 0;
					if (snr <= 0) return;
					
					var corrected = parseInt(columns[headerColumnMappings["Corrected"]].textContent) || 0;
					var uncorrected = parseInt(columns[headerColumnMappings["Uncorrected"]].textContent) || 0;
					var noiseFloor = power - snr;
					
					var channel = {
						channelId: channelId,
						frequency: frequency,
						power: power,
						snr: snr,
						corrected: corrected,
						uncorrected: uncorrected,
						noiseFloor: noiseFloor
					};
					
					downstreamChannels.push(channel);
				});
			}
			
			//Upstream Bonded Channels
			if (sectionName == "Upstream Bonded Channels") {
				// Get headers
				var headers = contentTable.querySelectorAll("td.moto-param-header-s");
				var headerColumnMappings = [];
				var headerNameMappings = [];
				headers.forEach(function (header, index) {
					headerNameMappings[index] = header.textContent.trim();
					headerColumnMappings[header.textContent.trim()] = index;
				});
				
				// Get rows (channels)
				var rows = contentTable.querySelectorAll("tr:not(:first-child)");
				
				rows.forEach(function(channel, rowIndex) {
					var columns = channel.querySelectorAll("td");
					
					// Ensure channel is locked
					var lockStatus = columns[headerColumnMappings["Lock Status"]].textContent.trim();
					if (lockStatus != "Locked") return;
				
					// Parse columns
					var channelId = parseInt(columns[headerColumnMappings["Channel ID"]].textContent) || 0;
					var frequency = (parseFloat(columns[headerColumnMappings["Freq. (MHz)"]].textContent) * 1000000) || 0;
					var power = parseFloat(columns[headerColumnMappings["Pwr (dBmV)"]].textContent) || 0;
					var symbolRate = parseFloat(columns[headerColumnMappings["Symb. Rate (Ksym/sec)"]].textContent) || 0;
					
					var channel = {
						channelId: channelId,
						frequency: frequency,
						power: power,
						symbolRate: symbolRate
					};
					
					upstreamChannels.push(channel);
				});
			}
			
			//Downstream Frequency Setting
		});
		
		var dataPoint = {
			"date": new Date(getUtcOffset(new Date())),
			"data": {
				"modem": {
					"ds": {},
					"us": {}
				}
			}
		};
		
		// Submit downstream channels
		downstreamChannels.forEach(function(channel) {
			dataPoint.data.modem.ds[channel.channelId] = {
				channelId: channel.channelId,
				power: channel.power,
				frequency: channel.frequency,
				snr: channel.snr,
				corrected: channel.corrected,
				uncorrected: channel.uncorrected,
				noise: channel.noiseFloor
			};
		});
		
		// Submit upstream channels
		upstreamChannels.forEach(function(channel) {
			dataPoint.data.modem.us[channel.channelId] = {
				channelId: channel.channelId,
				power: channel.power,
				frequency: channel.frequency,
				symrate: channel.symrate
			};
		});
		
		buffer.push(dataPoint);
	});
	
	setTimeout(makeRequest, 15000);
}

function sendBuffer() {
	var bufferCopy = buffer.slice();
	var influxDataPoints = [];
	
	bufferCopy.forEach(function(dataPoint, index) {
		Object.keys(dataPoint.data.modem.ds).forEach(function(channelId) {
			var ds = dataPoint.data.modem.ds[channelId];
			influxDataPoints.push({
				measurement: 'downstream',
				tags: { channelId: ds.channelId, frequency: ds.frequency },
				fields: { power: ds.power, snr: ds.snr, corrected: ds.corrected, uncorrected: ds.uncorrected, noise: ds.noise },
				timestamp: new Date(dataPoint.date)
			});
		});
		Object.keys(dataPoint.data.modem.us).forEach(function(channelId) {
			var us = dataPoint.data.modem.us[channelId];
			influxDataPoints.push({
				measurement: 'upstream',
				tags: { channelId: us.channelId, frequency: us.frequency },
				fields: { power: us.power, symbolRate: us.symrate },
				timestamp: new Date(dataPoint.date)
			});
		});
		influxDataPoints.push({
			measurement: 'downstreamBonded',
			fields: { number: Object.keys(dataPoint.data.modem.ds).length },
			tags: {  },
			timestamp: new Date(dataPoint.date)
		});
		influxDataPoints.push({
			measurement: 'upstreamBonded',
			fields: { number: Object.keys(dataPoint.data.modem.us).length },
			tags: {  },
			timestamp: new Date(dataPoint.date)
		});
		
		if (influxDataPoints.length > 0) {
			influx.writePoints(influxDataPoints).then(() => {
				buffer.splice(index, 1);
			}).catch((err) => {
				console.log(err);
			});
		}
	});
	
	
	
	setTimeout(sendBuffer, 5000);
}

makeRequest();
sendBuffer();