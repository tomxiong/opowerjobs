/*!
 * OPOWER Jobs
 * Copyright(c) 2010 Dylan Greene <dylang@gmail.com>
 * MIT Licensed
 */

var log = require('./util/log').from(__filename),
    all_jobs = {}, all_locations = {}, all_teams = {}, all_ids = {}, all_search = {}, all_urls = {},
    all_new = [], all_critical = [],
    team_pages = {},
    search_log = {},
    location_hash = {'arlington': 'DC/Northern Virginia'},
    Jobvite = require('./jobvite');


var fs = require('fs');

function reload(callback, andSave) {
    log('RELOAD FROM JOBVITE');
    Jobvite.download(function(data) {
        if (data) {
            init(data);
            log('update complete');
        } else {
            log('ERROR', 'No data from update!');
        }
        callback && callback(data);
    }, andSave);
}



function BLAHBLAH() {
    var prev_ids = clone(all_ids);

    //delete prev_ids.ocXkVfw8;
    //prev_ids.o1rmVfwt.title = 'wazzup';


    log('reload');
    init();
    var added = {};

    all_ids.forEach(function(curr, id) {
        var prev = prev_ids[id];
        if (!prev) {
            log('was', id);
            log('added',  curr.id);
        } else {
            if (prev.title != curr.title) {
                log('title changed:', curr.title, 'was', prev.title);
            }
        }
    });

}



function clone(orig) {
    var copy = {};
    orig.forEach(function(data, id) {
        log(id);
        return copy[id] = data;
    });
    return copy;    
}


function discover_team_pages() {

    var files = fs.readdirSync('./views/partials/teams/'); 
    files.map(function(file){
        var filename = file.split('.');
        if (filename[1] == 'ejs') {
            team_pages[filename[0]] = filename[0];
        }
    });
}



function location_lookup(location) {
    var lookup = location.toLowerCase();
    return location_hash[lookup] ? location_hash[lookup] : location;
}

/* make almost any string good for a url path */
function urlize(s) {
    return (s || '').toLowerCase().replace(/[^a-z]+/gi, '-');
}
function create_job_url(job) {
    var location_url = job.location.toLowerCase().replace(/[^a-z]+/gi, '-');

    var team = job.team;
    var team_url = urlize(team);

    var title_url = urlize(job.title);

    var long_url = ['', location_url, team_url, title_url ].join('/');
    var apply_url = '/apply' + long_url;
    return {location: location_url, team: team_url, title: title_url, long_url: long_url, apply: apply_url };
}


function remove_html(string) {
    return string.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
}

function create_search_string(job) {
    return remove_html([job.title, job.url.location, job.url.team]
            .join(' ')
            .toLocaleLowerCase());
}


var sort_team = function(a, b) {
    if (a.team < b.team) return -1;
    if (a.team > b.team) return 1;
    return 0;
},
    sort_title = function(a, b) {
    a = a.title ? a : all_ids[a];
    b = b.title ? b : all_ids[b];

    if (a.title < b.title) return -1;
    if (a.title > b.title) return 1;
    return 0;
},
    sort_date = function(a, b) {
    a = a.date ? a : all_ids[a];
    b = b.date ? b : all_ids[b];

    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return 0;
    };

function format_description(desc) {

    desc = desc
            .trim()
            .replace(/Do you[^!]*homes\./, '')
            .replace(/About the Company.*/, '')
            .replace(/OPOWER is an Equal.*/, '')
            .replace(/\n/, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&ndash;/g, "&bull;").replace(/&middot;/g, "&bull;")
            .replace(/\s\s/g, ' ')
            .replace(/<strong>/g, '')
            .replace(/:?<\/strong>/g, '')
            .replace(/<br[^>]*>\s*<br[^>]*>/g, '<br /><br />');

    var j1 = desc.split(/(Primary Responsibilities)|(The Ideal candidate)|(The Job)|(Job Description)|(About the Role)|(About the job)|(About the Job)|(About theJob)|(ABOUT THE JOB)|(Core Responsibilities)|(Responsibilities)|(REQUIREMENTS)|(About You)/);
    var j2 = [];
    var d = [];

    j1.forEach(function(section) {
        if (section) {
        section = section.replace(/^:/g, '')
            .replace(/^<br \/>|<br \/>$/g, '')
            .trim()
            .replace(/^<br \/>|<br \/>$/g, '');
        }
        if (section) { j2.push(section); }
    });

    j2 = j2.map(function(section) {
        return section
            .replace(/^:/g, '')
            .replace(/^<br \/>|<br \/>$/g, '')
            .trim()
            .replace(/^<br \/>|<br \/>$/g, '');

    });

    var i, l;

    for (i=0, l=j2.length; i<l; i++) {
        if (j2[i].length) {
            var title = j2[i],
                p = j2[i+1];

            if (p && p.search(/^<ul/) === -1) {
                p = '<p>' + p + '</p>';
                p = p.replace(/<br \/>(<em>)?<\/p>/g, '</p>')
                    .replace(/<p>(<\/em>)?<br \/>/g, '<p>');
            }

            d.push({title: title, p: p });
            i++;
        }
    }
    return d;
}


function format_results(data) {
    var jobs = { };

    data.sort(sort_team);

    data.forEach(function(job) {

        var urls = job.url;

        if (all_urls[urls.long_url] && false /* TODO: REMOVE */) {
            log('Duplicate:', urls.long_url);
        }
        else {

            all_urls[urls.long_url] = job.id;
            if (!all_urls['/' + urls.title]) {
                all_urls['/' + urls.title] = job.id;
            }

            job.description = format_description(job.description);
            all_locations[urls.location] = job.location;
            all_teams[urls.team] = job.team;
            all_ids[job.id] = job;
            all_new.push(job.id);
            if (job.critical) {
                all_critical.push(job.id);
            }

            all_search[job.id] = {
                search_string: create_search_string(job),
                title: job.title,
                url: urls,
                id: job.id,
                location: job.location,
                team: job.team};



            var location = urls.location;
            jobs[location] = jobs[location] || {};

            var team = urls.team;
            jobs[location][team] = jobs[location][team] || [];
            jobs[location][team].push(job);
        }
    });

    jobs.forEach(function(location, location_key){
        jobs[location_key].forEach(function(team, team_key) {
            jobs[location_key][team_key].sort(sort_title);

            jobs[location_key][team_key].forEach(function(job, job_id) {

                job.similar = similar(job);
            });
        });
    });

    all_new.sort(sort_date);
    all_critical.sort(sort_title);

    log('unique ids:', Object.keys(all_ids).length);
    log('new count:', all_new.length);
    log('critical count:', all_critical.length);
    return jobs;
}

function add_to_search_log(query, jobs) {
    query = query.toLowerCase();
    search_log[query] = search_log[query] || { query: query, count: 0, last_search: 0, first_search: new Date(), results: 0};

    search_log[query].count++;
    search_log[query].last_search = new Date();
    search_log[query].results = jobs.length;
    log(search_log[query]);
}

function search(query) {
    query = remove_html(query).replace(/[^a-zA-Z]/g, ' ').replace(/\s\s/g, ' ') || false;
    if (!query) { return; }
    var jobs = [],
        search_array = query.toLowerCase().split(/[\s|\+]/);

    if (query == 'log') { return jobs; }
    
    all_search.forEach(function(value, key) {
        jobs.push(value);
    });

    search_array.forEach(function(search_for) {
        jobs = jobs.filter(function(value, key) {
            return value.search_string.search(search_for) !== -1;
        });
    });

    add_to_search_log(query, jobs);

    return jobs;
}

function similar(job) {



    var title = job.title,
        matches = [],
        search_for = (title.toLowerCase().match(/(professional services)|(user experience)|(recruit)|(market)|(director)|(test)|(software engineer)|(architect)|(vp)|(sales)/) || [])[0];

    if (search_for) {
    all_ids.forEach(function(j, job_id) {
        if (j.id != job.id && job.location == j.location && j.title.toLowerCase().search(search_for) !== -1) {
            matches.push(j);
        }
    });
    }

    return matches;
}

function init(new_data) {
    all_jobs = {}; all_locations = {}; all_teams = {};  all_ids = {}; //Object.keys(all_ids).forEach(function(key) { delete all_ids[key]; } );
    all_search = {}; all_urls = {};
    all_new = []; all_critical = [];

    log(new_data ? 'NEW DATA!' : 'no new data, going to use cache.');
    var count = 0,
        data = new_data || Jobvite.data();

    var jobs = [];

    data.job.forEach(function(job) {
        count++;
        job.title = job.title
                .trim()
                .replace(/\s?- \w?\w?st Coast/, '')
                .replace('(Arlington, VA)', '')
                .replace('Executives', 'Executive')
                .replace('Engineers', 'Engineer')
                .replace(' - San Francisco', '')
                .replace('Sr.', 'Senior')
                .trim();

        job.team = job.category;
        delete job.category;

        job.location = location_lookup(job.location.replace(/,.*/, ''));

        job.url = create_job_url(job);

        if (job.requisitionId.length) {
            job.critical = job.requisitionId.toLowerCase().indexOf('critical') !== -1;
        }

        job.date = new Date(job.date);

        jobs.push(job);
    });
    log('job count:', jobs.length);
    all_jobs = format_results(jobs);

    
    log('init complete');

}




init();
discover_team_pages();
module.exports.data = function() { return { team_pages: team_pages, all_jobs: all_jobs, all_locations: all_locations, all_teams: all_teams, all_ids: all_ids, all_urls: all_urls, all_critical: all_critical, all_new: all_new, search_log:  search_log }; };
module.exports.urilze = urlize;
module.exports.search = search;
module.exports.reload = reload;