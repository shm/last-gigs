/* Author: 
	shm <notyce@gmail.com>, 2011
*/


$(function() {

	window.Attendee = Backbone.Model.extend({
		initialize: function( ) {
			this.count = 1 ;
			new AttendeeView({model: this}) ;
		},
		setCount: function(c) {
			this.count = c ;
		},
		incrementCount: function() {
			this.count += 1 ;
		}
	}) ;
	
	window.AttendeeView = Backbone.View.extend({
		tagName:  "li",
		template: _.template($('#item-template').html()),

		initialize: function() {
	      this.model.view = this;
	    },
		render: function() {
			$(this.el).html(this.template(this.model));
			if( this.model && this.model.count ) {
				$(this.el).find(".bar-container .bar").animate({width:this.model.count*10 + "px"}) ;
		    }
			return this;
		}
	}) ;

	window.AttendeeList = Backbone.Collection.extend({
		model: Attendee,
		url: null,
		parse: function(results) {
			if( results ) {
				return results.attendees.user ;
			}
			return null ;
		},
		comparator: function(todo) {
			return todo.count ;
	    },
	}) ;
	
	
	window.Event = Backbone.Model.extend({
		initialize: function( ) {
			this.attendeeNames = [] ;
		},
		urlForEventAttendees: function() {
			return "http://ws.audioscrobbler.com/2.0/?format=json&method=event.getattendees&event=" + this.attributes.id + "&api_key=98d1bb52576ecc63b1ff119f3326bcf0" ;
		},
		clear: function() {
		},
		addAttendeeName:function(name){
			this.attendeeNames.push(name) ;
		}
	}) ;
	
	window.EventList = Backbone.Collection.extend({
		model: Event
	}) ;
	
	
window.Workspace = Backbone.Controller.extend({

  	routes: {
    	"show/:username":                 "showEventsForUser", 
		"show/:username/with/:withUsername": "showEventsWithUser"
  	},

	eventsTemplate: _.template($('#events-template').html()),
	initialize: function() {
		this.app = new AppView() ;
//		$('#loading').hide() ;
		
	},
	infoQueue: [],
	request: function(url, success) {
	    var params = {
	      url:         url,
	      contentType:  'application/json',
	      dataType:     'jsonp',
	      processData:  false,
	      success:      success
	    };
	
		return $.ajax(params) ;
	},
	showInfo: function(infotext) {
		this.infoQueue.push(infotext) ;
		$('#loading ul').append("<li>" + infotext + "<br /><img src='images/spinner.gif' /></li>")
		var offset = -1 * (_.size(this.infoQueue)) * 960 ;
		$('#loading ul').animate({left:offset + "px"}) ;
	},
	topAttendeesByCount: function(count) {
		return this.app.attendeeList.sort().reverse().models.slice(0,count) ;
	},
	showEventsWithUser: function(myname, username) {
		var events = _.select(this.app.eventList.models, function(i) { return _.indexOf(i.attendeeNames, username) != -1 ; } ) ;
		$('.eventList-container').html( _.template(this.eventsTemplate({withUserName:username,items:events}))) ;
		$('.mainList').css({position:'relative'}) ;
		$('.mainList').animate({left:'-960px'}) ;
		$('#back').click( function() { $('.mainList').animate({left:'0px'}); }) ;
	},
	showEventsForUser:function(username) {
		this.infoQueue = [] ;
		$('#loading ul').css({display:"block", left:"0px"}).html("<li>&nbsp;</li>");
		$('#lastfm-name').val(username) ;
		$('#attendees').html("") ;
		$('#status').html("") ;
		
		this.showInfo("fetching your past & future events") ;
		
		this.username = username ;
		this.app.eventList = new EventList() ;
		
		var pastEvents = this.request(this.pastEventsUrl(username), function(data) {
			Routes.app.eventList.add(data.events.event) ;
		}) ;
		this.app.ajaxQueue.push(pastEvents) ;

		var futureEvents = this.request(this.futureEventsUrl(username), function(data) {
			Routes.app.eventList.add(data.events.event) ;
		}) ;
		this.app.ajaxQueue.push(futureEvents) ;
		$.when.apply($,this.app.ajaxQueue).done( function() {
			$('#status').html(Routes.app.eventList.models.length + " Events found!<br />") ;
			Routes.initAttendees() ; 
		}) ;
	},
	initAttendees: function() {
		Routes.showInfo("fetching list of attendees") ;
		this.app.attendeeList = new AttendeeList() ;
		
		_.each( this.app.eventList.models, function(ev) {
			var eventModel = ev ;
			var getEvents = Routes.request( Routes.attendeeUrl(ev.attributes.id), function(data) {
				if( data.attendees == null )return ;
				var attendees = data.attendees.user ;
				_.each( attendees, function(attendee) {
					if( typeof attendee !== 'object')return;
					if(attendee.name == Routes.username)return ;
					eventModel.addAttendeeName(attendee.name) ;
					var existingAttendees = Routes.app.attendeeList.filter( function(e) { return e.attributes.name == attendee.name }) ;
					if( existingAttendees.length > 0 ) {
						existingAttendees[0].incrementCount() ;
					} else {
						Routes.app.attendeeList.add([attendee]) ;
					}
				}) ;
			}) ;
			Routes.app.ajaxQueue.push(getEvents) ;
		}) ;
		$.when.apply($, this.app.ajaxQueue).then( function() { 
			$('#status').append(Routes.app.attendeeList.models.length + " Attendees found!<br />") ;
			Routes.showInfo("Calculating") ;
			Routes.app.render() ; }) ;
	},
	attendeeUrl: function(event_id) {
		return "http://ws.audioscrobbler.com/2.0/?format=json&method=event.getattendees&event=" + event_id + "&api_key=" + this.app.apiKey ;
	},
	pastEventsUrl: function(username) {
		return "http://ws.audioscrobbler.com/2.0/?limit=200&format=json&method=user.getpastevents&user=" + username + "&api_key=" + this.app.apiKey ; 
	},
	futureEventsUrl: function(username) {
		return "http://ws.audioscrobbler.com/2.0/?limit=200&format=json&method=user.getevents&user=" + username + "&api_key=" + this.app.apiKey ; 
	}
});

	window.AppView = Backbone.View.extend({
		el: $("#top"),
		apiKey: "<YOUR_LAST_FM_API_KEY>",
		ajaxQueue: [],
		events: {
		      "keypress #lastfm-name":  "doStuff",
			},
		doStuff: function(e) {
			 if (e.keyCode != 13) return;
			window.location = "#show/" + $('#lastfm-name').val() ;
			
		},
		render: function() {
			_.each( Routes.topAttendeesByCount(10), function(item) { Routes.app.$("#attendees").append(item.view.render().el) } ) ;
			Routes.showInfo("voilà .. your top 10 gig-buddies:") ;
//			$('#loading ul').delay(3000).fadeOut() ;
			$('#loading img').hide() ;
		},
	}) ;

	window.Routes = new Workspace() ;
	Backbone.history.start() ;
	// $('.bar-container').live('click', function() {
	// 	Routes.showEventsWithUser( $(this).attr('data-user-name') ) ;
	// }) ;
}) ;




















