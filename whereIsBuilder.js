var csv = require('ya-csv');
var fs = require('fs');

var directory = 'public/';

//cleanup
console.log('deleting files from ' + directory);
fs.readdirSync(directory).forEach(function(file) {
	fs.unlinkSync(directory + file);
});

//moving index.html into place
console.log('moving index.html into public');
fs.writeFileSync(directory + 'index.html', fs.readFileSync('./index.html'));


//creating robots.txt
console.log('creating robots.txt');
fs.writeFile(directory + 'robots.txt', 'User-agent: *\nDisallow:\nsitemap: http://whereisthis.herokuapp.com/sitemap.xml');

//creating sitemap
console.log('creating sitemap.xml');
fs.writeFileSync(directory + 'sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\t<url><loc>http://whereisthis.herokuapp.com</loc></url>');

console.log('building files for states and provinces');
var template = fs.readFileSync('template.html' ,'utf8');

loadStaticBlurbs();

var _staticBlurbs = {};
function loadStaticBlurbs() {
	console.log('loading static blurbs');

 	var reader = csv.createCsvFileReader('static-blurbs.csv', {
		separator: ',',
		quote: '"',
		'escape': '"',       
		comment: '',
		columnsFromHeader: true
	});

	reader.addListener('data', function(data) {
		_staticBlurbs[data.name.toLowerCase()] = data.blurb;
	});

	reader.addListener('end', function() {
		generateStates();
	});
}

function getStaticBlurb(name) {
	return _staticBlurbs[name.toLowerCase()];
}

function generateStates() {

	console.log('generating states and provinces');
	var reader = csv.createCsvFileReader('states-and-provinces.csv', {
		separator: ',',
		quote: '"',
		'escape': '"',       
		comment: '',
		columnsFromHeader: true
	});
	reader.addListener('data', function(data) {
		//data.alias
		var names = [data.name];

		if(data.alias.trim() !== '') {
			var aliases = data.alias.split('|');
			for(var i in aliases)
				names.push(aliases[i]);
		}	

		for(var i in names) {
			var name = names[i].trim();

			//skip place names that have unknown characters
			if(name.indexOf('?') >= 0 || name === '')
				continue;

			var pageName = createProvincePage(name, data.engtype_1, data.country, data.region, data.area_sqkm, data.abbrev, data.postal, data.json);
			addPageToSitemap(pageName);
			addLinkToLandingPage(name, pageName)
		}
	});

	
	reader.addListener('end', function() {
		generateCountries();
	});
}

function generateCountries() {
	
	console.log('building files for countries');
	var reader = csv.createCsvFileReader('countries.csv', {
		separator: ',',
		quote: '"',
		'escape': '"',       
		comment: '',
		columnsFromHeader: true
	});
	reader.addListener('data', function(data) {
		if(data.name_forma && data.name_forma.indexOf('?') < 0 && data.name_forma !== '') {
			var pageName1 = createCountryPage(data.name_forma, data.type, data.sovereignt, data.abbrev, data.postal, data.json_4326);
			addPageToSitemap(pageName1);

			addLinkToLandingPage(data.name, pageName1)
		}

		if(data.name && data.name.indexOf('?') < 0 && data.name !== '') {
			var pageName2 = createCountryPage(data.name, data.type, data.sovereignt, data.abbrev, data.postal, data.json_4326);
			addPageToSitemap(pageName2);
		}
	});

	reader.addListener('end', function() {
		finishSitemap();
	});
}

function limitNameToAscii(name) {
	//some names have their region after a comma, so just take the first part
	name = name.split(',')[0];
	return name.replace(/`/g,'');
}

function createProvincePage(name, type, country, region, size, abbrev, postal, json) {
	//open template
	var blurb = generateBlurb(name, type, country, region, size, abbrev, postal);

	var fileName = buildFileName(name);

	//write to new file
	fs.writeFileSync(directory + fileName,  generateTemplate(name, blurb, json));

	//return new file name
	return fileName;
}

function createCountryPage(name, type, sovereignt, abbrev, postal, json) {
	//open template
	var blurb = generateCountryBlurb(name, type,  sovereignt, abbrev, postal);

	var fileName = buildFileName(name);

	//write to new file
	fs.writeFileSync(directory + fileName,  generateTemplate(name, blurb, json));

	//return new file name
	return fileName;
}

function generateTemplate(name, blurb, json) {
	return template.replace(/<% name %>/g, name).replace(/<% blurb %>/g, blurb).replace(/<% json %>/g, json);
}

function buildFileName(name) {
	return name.replace(/ /g, '_').replace(/\./g, '_').replace(/\//g, '_').toLowerCase() + '.html';
}

function addPageToSitemap(fileName) {
	var sitemapEntry = '<url><loc>http://whereisthis.herokuapp.com/' + fileName + '</loc></url>\n'; //TODO: encode url
	fs.appendFileSync(directory + 'sitemap.xml', sitemapEntry);
}

function finishSitemap() {
	console.log('finishing sitemap.xml');
	fs.appendFileSync(directory + 'sitemap.xml', '</urlset>');
}


var landingPageQualitity = ['canada', 'nova scotia'];
function addLinkToLandingPage(name, pageName) {
	if(landingPageQualitity.indexOf(name.toLowerCase()) < 0)
		return;

	var link = '<a href="' + pageName + '">' + name + '</a>';
	fs.appendFileSync(directory + 'index.html', link);
}

function generateBlurbHeader(name) {
	return '<h2>Where is ' + name + ' located? </h2>';
}

function generateCountryBlurb(name, type, sovereignt, abbrev, postal) {
	var blurb = getStaticBlurb(name);
	if(blurb)
		return generateBlurbHeader(name) + blurb;

	blurb = [generateBlurbHeader(name), name];

	blurb.push(' is a ');
	blurb.push(type);

	if(type && type.toLowerCase() === 'dependency') {
		blurb.push(' of ');
		blurb.push(sovereignt);
	} 
	blurb.push('.');

	if(abbrev) {
		blurb.push(' Its abbreviated name is ');
		blurb.push(abbrev);
		if(!postal)
			blurb.push('.');
	}

	if(postal) {
		if(abbrev) 
			blurb.push(' and its');
		else
			blurb.push(' Its');

		blurb.push(' postal identifier is ');
		blurb.push(postal);
		blurb.push('.');	
	}

	return blurb.join('');
}

function generateBlurb(name, type, country, region, size, abbrev, postal) {
	
	var blurb = getStaticBlurb(name);
	if(blurb)
		return generateBlurbHeader(name) + blurb;

	//build blurb content
	blurb = [generateBlurbHeader(name), name];

	if(type) {
		blurb.push(', is a ');
		blurb.push(type.toLowerCase());

		if(!region && !country)
			blurb.push('.');
	}

	if(region) {
		blurb.push(' of the ');
	 	blurb.push(region);
		blurb.push(' region.');
	}

	if(country) {
		if(type || region)
			blurb.push(' It')
		else
			blurb.push(' which')
		blurb.push(' belongs to the country of ');
		blurb.push(country);
		blurb.push('.');
	}

	if(abbrev) {
		blurb.push(' Its abbreviated name is ');
		blurb.push(abbrev);
		if(!postal)
			blurb.push('*');
	}

	if(postal) {
		if(abbrev) 
			blurb.push(' and its');
		else
			blurb.push(' Its');

		blurb.push(' postal identifier is ');
		blurb.push(postal);
		blurb.push('.');	
	}

	if(size) {
		if(!region && !type)
			blurb.push(' has an area of ');
		else {
			blurb.push(name);
			blurb.push(' has an area of ');
		}
		blurb.push(Math.round(size));
		blurb.push(' square kilometeres.');
	}

	return blurb.join('');
}