(function _usp_init(port, controller, user, pass, site, secure, debug, init) {
    const UnifiEvents = require('unifi-events');
    const express = require('express');
    let unifi = new UnifiEvents({
	controller: controller,
	username: user,
	password: pass,
	site: site,
	rejectUnauthorized: secure,
	listen: true
    });
    let scoreboard = {
    };
    if (init) {
	init.split(',').forEach((mac) => {
	    scoreboard[mac] = { here: true };
	});
    }
    function dbg(msg) {
	if (debug) {
	    console.log(msg);
	}
    }
    unifi.on('connected', (data) => {
	if (data.user) {
	    data._usp_connected = true;
	    scoreboard[data.user] = data;
	    dbg('Hello ' + (data.hostname || data.user));
	} else {
	    dbg('Connected: ' + JSON.stringify(data));
	}
    });
    unifi.on('EVT_WU_ROAM', (data) => {
	dbg('User Roam: ' + JSON.stringify(data));
    });
    unifi.on('disconnected', (data) => {
	if (data.user) {
	    if (scoreboard[data.user]) {
		scoreboard[data.user]._usp_connected = false;
	    } else {
		scoreboard[data.user] = {_usp_connected: false};
	    }
	    dbg('Bye: ' + (data.hostname || data.user));
	} else {
	    dbg('Disconnected: ' + JSON.stringify(data));
	}
    });
    unifi.on('websocket-status', (data) => {
	dbg('socket status: ' + JSON.stringify(data));
    });
    const app = express();
    app.get('/present/:target', (req, res) => {
	let answer = { success: true, present: false };
	if (req.params && req.params.target && scoreboard[req.params.target]) {
	    answer.present = scoreboard[req.params.target]._usp_connected;
	    if (debug) {
		answer.additional =
		    JSON.stringify(scoreboard[req.params.target]);
	    }
	    dbg('response from cache: ' + req.params.target + ' ' +
		((answer.present) ? 'present' : 'gone'));
	    res.send(answer);
	} else {
	    unifi.getClient(req.params.target).then((client) => {
		if (client.uptime) {
		    client._usp_connected = true;
		    scoreboard[req.params.target] = client;
		    answer.present = true;
		} else {
		    client._usp_connected = false;
		    scoreboard[req.params.target] = client;
		}
		dbg('response from controller: ' + req.params.target + ' ' +
		    ((answer.present) ? 'present' : 'gone'));
		res.send(answer);
	    });
	}
    });
    app.get('/ayt', (req, res) => res.send('Yes.'));
    app.listen(port, () => {
	dbg('unifi-smartthings-presence listening on port ' + port);
    });
})(process.env.PORT || 54321,
   process.env.CONTROLLER || 'https://127.0.0.1:8443',
   process.env.USER || 'usp_user',
   process.env.PASSWORD || 'usp_password',
   process.env.SITE || 'default',
   process.env.SECURE || false,
   process.env.DEBUG || 0,
   process.env.PRESENT || '');
