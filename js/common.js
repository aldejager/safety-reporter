// Global variable that will tell us whether PhoneGap is ready

// TODO: smooth unsent report sending routine, pop-ups don't show or there is no transition'


// Initiation parameters
var intervalID = null;
var readyCount = 0;

// Global parameters
var noStorage = false;
var index = null;
var networkState = 'none';
var unsent = new Array();
var sendingUnsent = false;

// Set an onload handler to call the init function
window.onload = init;

function init() {				// Runs when DOM has finished loading
	
	if (!Modernizr.localstorage) {
		noStorage = true;
		$('.save').hide();
		$('.nav').hide();
		$('#domainField').show();
		//alert("Cannot store reports locally. Use only with stable internet connection!");
	}
	
    // Add an event listener for deviceready
    document.addEventListener('deviceready', onDeviceReady, false)
	
    // Older versions of Blackberry < 5.0 don't support PhoneGap's custom events
    intervalID = window.setInterval(function() {
    	if (window.cordova) {
    		window.clearInterval(intervalID);
    		onDeviceReady();
   		}
   	}, 1000); /* */
}

function onDeviceReady() {		// Code to be executed once the device is finished loading
	
	// Prevent multiple calls of device ready function
	if(readyCount > 0) return; 
    readyCount += 1;
    
// -------------------------------------------- //
//     Methods and events on device ready 		//
// -------------------------------------------- //
    
    // Serialize form objects function
    $.fn.serializeObject = function() {
	    var o = {};
	    var a = this.serializeArray();	
	    $.each(a, function() {
	        if (o[this.name] !== undefined) {
	            if (!o[this.name].push) {
	                o[this.name] = [o[this.name]];
	            }
	            o[this.name].push(this.value || '');
	        } else {
	            o[this.name] = this.value || '';
	        }
	    });
	    return o;
	};
	
	// Store object as JSON by key
	$.fn.storeJSON = function(key) {
		var data = JSON.stringify($(this).serializeObject());
		console.log("JSON stored: " + data);
		localStorage.setItem(key, data);
	}
	
	$('#mainPage').on('pagebeforeshow', function() {
		sendingUnsent = false;
		loadReports();
	}); /* */
	
	$('#configPage').on('pagebeforeshow', function() {
		fillFields(config);
	}); /* */
	
	$('#reportPage').on('pagebeforeshow', function() {
		if (noStorage) {
			$('#report')[0].reset();
			fillFields(currentReport);
		} else {
		
		// Format reporting page based on current report
		switch(currentReport.reportStatus) {
			case 'sent': 	// sent reports can only be reviewed
				$('#report')[0].reset();
				fillFields(currentReport);
				// inform user that the report is final 
				$('.formField').attr('readonly');
				$('#saveReport').hide();
				$('#cancelReport').hide();
				$('#formSubmit').show();
				//$('#formSubmit').attr('disabled', true);
				console.log("sent report loaded");
				break;
			case 'unsent': 	// submitted but not sent
				console.log("unsent report loaded");
				$('#report')[0].reset();
				fillFields(currentReport);
				// inform the user that the report wasn't sent
				$('#saveReport').hide();
				$('#cancelReport').hide();
				$('#formSubmit').show();
				if (sendingUnsent) $('#formSubmit').hide();
				break;
			case 'saved': 	// report in progress
				console.log("saved report loaded");
				$('#report')[0].reset();
				$('#saveReport').show();
				$('#cancelReport').show();
				$('#formSubmit').show();
				fillFields(currentReport);
				break;
			default:	// create new report, use defaults, set only id
				console.log("new report page loaded");
				$('#report')[0].reset();
				$('#reportIndex').val('-');
				$('#reportStatus').val('new');
				$('#date').val(new Date().toJSON().slice(0,10));
				//console.log($('#reportStatus').val());
				$('#saveReport').show();
				$('#cancelReport').show();
				console.log("Index of new report: " + index);
				$('#reportIndex').val(index);	
				$('#formSubmit').show();		
				break;
		}}				
	
	}); // reporting page before show
	
	// Handle report submission
	$('#report').submit(function() {
		event.preventDefault();
		
		// document.getElementById('reportStatus').value == 'sent'
		if ($('#reportStatus').val() == 'sent') {
			console.log($('#reportStatus').val());
			console.log($('#report').serializeObject());
			flashPopup('#F-reportSubmitted',3000);
			setTimeout(directionHandler,3500); 
			return false;
		}
		
		currentReport = $('#report').serializeObject();

		// Small trick to remember the domain for the current session
		if (noStorage) config.domain = $('#submitDomain').val();
		else saveReport('unsent');
		
		sendReport();
		
		return false;
	}) // report submit
	
	// Show listed report once clicked
	$('#reportList').on('click', 'li', function() {
		currentReport = getStoredObject($(this)[0].id);
		//console.log(currentReport);
		index = currentReport.reportIndex;
		$.mobile.changePage('#reportPage');
	});
	
	$('#PU-sure').on('click', '#yes', function() {
		resetCR();
		if (noStorage) $.mobile.changePage('#reportPage', 
			{allowSamePageTransition: true, transition: 'none'});
		else $.mobile.changePage('#mainPage', 
			{allowSamePageTransition: true, transition: 'none'});
	});
	
// -------------------------------------------- //
//             App initiation logic 			//
// -------------------------------------------- //
    
    // DEBUG: notify on device status
    //alert('The device is now ready');
    
    loadReports();					// load existing reports into list
    var conn = checkConnection();	// check connection status
    checkConfiguration('init');		// check if app is configured
    
    // Check for unsent reports
    unsent = checkUnsentReports();
    if (unsent.length > 0 && conn != 'none') {
    	console.log('unsent reports found');
    	sendUnsent();
    }
	
} // Device Ready

function sendUnsent() {
	$('.PU-sendUnsent').popup('open');
}

function continueSendUnsent() {
	sendingUnsent = true;	
	var key = unsent[0];
	console.log("Now sending report: " + key);
	
	currentReport = getStoredObject(key);
	fillFields(currentReport);
	index = $('#reportIndex').val();
	console.log("report index: " + index);
	
	$.mobile.changePage('#reportPage', 
	 	{allowSamePageTransition: true, transition: 'none'});
	
	setTimeout(function() {sendReport();} ,500);
	
}

function newReport() {		// only for !noStorage branch
	currentReport = {};
	loadReportIndex();
	index ++;	
	$.mobile.changePage('#reportPage', 
		{allowSamePageTransition: true, transition: 'none'});
}

function saveReport(status) {
	
	if (status != undefined) {
		$('#reportStatus').val(status);
	} else if ($('#reportStatus').val().search('sent') == -1) {
		$('#reportStatus').val('saved');
	}
	
	console.log($(reportStatus));
	
	var old_key = false;
	Object.keys(localStorage).forEach(function(key) {
		if (key.search(reportFileName) != -1 &&
				key.search('-' + index + '-') != -1) {
			old_key = key;
		}
	})
	
	if (old_key) localStorage.removeItem(old_key);
	
	currentReport = $('#report').serializeObject();
	var key = reportFileName + index + '-' + currentReport.reportStatus; 
	$('#report').storeJSON(key);
	
	// if just saved, confirm success
	if (currentReport.reportStatus == 'saved') {
		flashPopup('#F-reportSaved',3000);
	}
}

function sendReport() {
	var conn = checkConnection();	// check network connection
	
	console.log(conn);
	switch(conn) {		// switch connection states
		case 'fine':
			console.log("connection fine: continue sending");
			continueSending();
			break;
		case 'cond':
			console.log("connection conditional: popup");
			$('#PU-connectionConditional').popup('open');
				// Continue: continueSending();
				// Cancel:	 reportNotSent();
			break;
		default:
			console.log("connection unavailable: popup");
			$('#PU-noConnection').popup('open');
				// Retry:	 sendReport();
				// Cancel:	 reportNotSent();
			break;
	}
}

function continueSending() {
	
	// Create destination address
	var target = 'http://' + config.domain + config.processor;
	
	console.log("Target for data:");
	console.log(target);
	
	var report = JSON.stringify(currentReport);
	
	console.log("Data to be send:");
	console.log(report);
	
	// perform some send action
	/*$.post(target, report, function(data){	
		res = data.length;
		console.log("Server return:");
		console.log(data);
	}); /* */
	
	// DEBUG: assume sent
	var success = true;
	
	if (success) {
		flashPopup('.F-reportSent',2000);
		setTimeout(function() {
			if(!noStorage) saveReport('sent');
			console.log('saving sent report');
			resetCR(); sendingUnsent = false;
			unsent = checkUnsentReports();
			if (unsent.length > 0) {console.log("more unsent reports..."); continueSendUnsent(); }
			else {console.log("DH on success"); directionHandler();}
		}, 2500);	
	} else reportNotSent();
	
	//return false
}

function reportNotSent() {
	console.log("DH on not sent");
	directionHandler();
	setTimeout(function() {
		flashPopup('.F-reportNotSent',4000)
	}, 1000);
}

function goHome() {
	if (currentReport.reportStatus == undefined || $('#reportStatus').val().search('sent') != -1) 
		directionHandler();
	else $('#PU-sure').popup('open');
}

function directionHandler() {
	if (noStorage) $.mobile.changePage('#reportPage',
		{allowSamePageTransition: true, transition: 'none'});
	else $.mobile.changePage('#mainPage',
		{allowSamePageTransition: true, transition: 'none'});
}

function resetCR() {
	if (noStorage) currentReport = {domain : config.domain};
	else currentReport = {};
}

function loadReports() {
	
	// If no storage or reports available, don't load reports
	if (noStorage) {
		$('#noStorageDiv').show();
		return false;
	}
	
	if (checkLocalStorage(reportFileName) == 0) {
		$('#noReportsDiv').show();
		$('#reportList').empty();
		return false;
	} else $('#noReportsDiv').hide();
	
	// Categorize reports and join results
	var html ='', sentReports ='', savedReports = '', unsentReports = '';
	Object.keys(localStorage).forEach(function(key) {
    	if (key.search(reportFileName) != -1) {
    		var obj = getStoredObject(key);
    		item = '<li id=' + key + '><a href="#">' + obj.date + ' ' + obj.time + ' at ' + obj.location + '</a></li>';
    		if (key.search("-sent") != -1) sentReports = item + sentReports;
    		else if (key.search("unsent") != -1) unsentReports += item;
           	else savedReports += item;
        } 
    });
    
    if (savedReports.length == 0)  	savedReports  	= "<li><p><b>No saved reports</b></p></li>";
    else savedReports = ' (' + checkLocalStorage('saved') + ') </li>' + savedReports;
    if (unsentReports.length == 0) 	unsentReports 	= "<li><p><b>No unsent reports</b></p></li>";
    else unsentReports = ' (' + checkLocalStorage('unsent') + ') </li>' + unsentReports;
    if (sentReports.length == 0) 	sentReports 	= "<li><p><b>No sent reports</b></p></li>";
    else sentReports = ' (' + checkLocalStorage('-sent') + ') </li>' + sentReports;
    
    html = '<li data-role="list-divider" data-theme="e">Not submitted' + savedReports + 
    	   '<li data-role="list-divider" data-theme="e">Not sent' + unsentReports + 
    	   '<li data-role="list-divider" data-theme="e">Completed' + sentReports;
    //console.log(html);

	// Create listview from html item list
	$('#reportList').empty();			// first clear old listview
    $('#reportList').append(html);  	// add new list to ul
	$('#reportList').trigger('create');
	$('#reportList').listview('refresh');
}

function flashPopup(id,time) {
	x = ($(window).width()-$(id).width())/2;
	$(id).hide().popup('open',{x:x, y:50});
	$(id).fadeIn(1000).fadeOut(time-1000);
	setTimeout(function() {
		console.log("flash closing: " + id);
		$(id).popup('close'); }, time);
}

function checkLocalStorage(snippet) {
	if (noStorage) return 0;
    var ii = 0;

    Object.keys(localStorage).forEach(function(key){ 
        if (key.search(snippet) != -1) ii++; 
    });
    return ii;
}

function getStoredObject(key) {
	return JSON.parse(localStorage.getItem(key));
}

function fillFields(obj) {
    for (var key in obj) {
    	var elem = '#' + key;
    	$(elem).val(obj[key]);
    }
    
    if (noStorage) $('#submitDomain').val(obj['domain']);
}

function loadReportIndex() {
	if (noStorage) return 0;
	
	index = 0;
	var dex = 0;
	Object.keys(localStorage).forEach(function(key) {
		if (key.search(reportFileName) != -1) {
			dex = parseInt(key.split('-')[1]);
		}
		if (dex > index) index = dex;
	});
	
	//console.log("index loaded: " + index);
}

function checkConnection() {	// Checks current network status
    networkState = navigator.connection.type;
    //console.log(networkState);

    /*var states = {};
    states[Connection.UNKNOWN]  = 'Unknown connection';
    states[Connection.ETHERNET] = 'Ethernet connection';
    states[Connection.WIFI]     = 'WiFi connection';
    states[Connection.CELL_2G]  = 'Cell 2G connection';
    states[Connection.CELL_3G]  = 'Cell 3G connection';
    states[Connection.CELL_4G]  = 'Cell 4G connection';
    states[Connection.NONE]     = 'No network connection'; */

	// DEBUG: notify on network state
    // console.log("connection type: " + networkState);
    
    if (networkState != 'wifi' && networkState != 'ethernet') {
		if (networkState.search('g') != -1) {
			//console.log("Any of the G's");
			return 'cond';
		}
		else {	// Inform user by prompt in the future
			//console.log("No suitable connection available");
			return 'none';
		}
	}
	else //console.log("Wifi or ethernet available");
	return 'fine';
}
   
function checkConfiguration(type) {
	if (noStorage) return false;
	
	if (checkLocalStorage(configFileName) == 0) {
    	if (type == 'init') {
    		$('#pleaseConfigure').show();
    		$.mobile.changePage('#configPage');
    	}
    	return false;
 	} else {
 		config = getStoredObject(configFileName);
		return true;
 	}
}

function saveConfiguration() {
	config = $('#configForm').serializeObject();
	
	if (noStorage) return false;

	var key = configFileName;
	if (checkLocalStorage(key) != 0) {
		alert("Overwrite configuration!");
	}
	$('#configForm').storeJSON(key);
	$('#pleaseConfigure').fadeOut(2000);
	setTimeout(function() {$.mobile.changePage('#mainPage');},2000);
}

function checkUnsentReports() {		// returns array of unsent report keys
	if (noStorage) return false;
	var keys = new Array(0);

	Object.keys(localStorage).forEach(function(key){ 
        if (key.search(reportFileName) != -1 &&
        		key.search('unsent') != -1) {
            keys.push(key);
        } 
    });

	console.log(keys);
	return keys;	
}

/*function findUnsentReports() {
	if (noStorage) return false;
	var unsent = checkLocalStorage(reportFileName) -
				 checkLocalStorage('sent');
	if (unsent > 0) {
		console.log(unsent + " unsent reports found");
		return true;
	}
	console.log("no unsent reports found");
	return false;	
} */

/*function getKey(filename) {
	if (indexing.increment) {
		indexing.increment = false;
		var ii = 0;
		while (ii < 10) {		// infinite loop error... consider limit
			console.log(ii)
			if (checkLocalStorage(filename + ii) == -1) {
				indexing.count = ii;
				console.log(filename + ii);
				return filename + ii;
				ii++
			}
			ii++;
		}
	}
	return filename + indexing.count;
} */

/* function checkLocalStorage(startsWith) {
	if (noStorage) return 0;
    var keyLength = startsWith.length;
    var ii = 0;

    Object.keys(localStorage) 
        .forEach(function(key){ 
            if (key.substring(0,keyLength) == startsWith) {
                ii++;
                //localStorage.removeItem(key); 
            } 
        });
    return ii;
} */

// window.localStorage.removeItem("key");

// OLD LOADREPORTS

  			/*var result = "Unsent";   			
  			li[0].innerHTML.split(" ").forEach(function(snippet) {
  				console.log(snippet);
  				if (snippet.search("id") != -1) {
  					console.log("ID found: " + snippet);
  					if (snippet.search("sent") != -1) {
  						console.log("Sent report found!");
  						result = "Sent";
  						//break;
  					}
  					//result = "Unsent Reports";
  					//break;
  				}
  			})
  			console.log("Result: " + result);
    		return result; /**/
    		
// END LOADREPORTS

// AUTO DIVIDERS

    /*$('#reportList').listview({autodividers: true,		// create autodividers
  		autodividersSelector: function ( li ) {
  			if (li.hasClass('sent')) return "Sent";
  			return "Unsent";
  		}
	});*/
	
// END AUTO DIVIDERS
