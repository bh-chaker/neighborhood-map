/*
 * Global Variables
 */
var wikipedia_api_url = 'https://en.wikipedia.org/w/api.php',
    places_to_visit = [
    "Opéra de Monte-Carlo",
    "Fort Antoine Theatre",
    "Saint Nicholas Cathedral, Monaco",
    "Monaco Top Cars Collection",
    "Oceanographic Museum",
    "Museum of Stamps and Coins",
    "Museum of Prehistoric Anthropology",
    "Prince's Palace of Monaco",
    "Japanese Garden, Monaco",
    "Jardin Exotique de Monaco",
    ],
    map,
    infowindow,
    placesList;

/*
 * Initializer functions
 */

// This function is called to start the loading process
function initialize_map() {
    var mapOptions = {
        // These are Monaco's coordinates
        center: new google.maps.LatLng(43.7328, 7.4197),
        zoom: 15
    };
    map = new google.maps.Map(document.getElementById('map-canvas'),
        mapOptions);

    infowindow = new google.maps.InfoWindow();

    google.maps.event.addListener(map, 'bounds_changed', initialize_markers);
}

// This function is called when the map is ready
function initialize_markers() {
    google.maps.event.clearListeners(map, "bounds_changed");

    places_to_visit.forEach(function(place_to_visit, index) {
        // Expect the call to Wikipedia API to finish in less than 2 seconds
        var jsonpError = window.setTimeout(function() {
            placesList.errorMessages.push('Was not able to fetch "' + place_to_visit + '"');
        }, 2000);

        /*
         * We query 4 properties from Wikipedia API:
         * - coorinates: To get the coordiates of the place to visit
         * - pageimages: To get the main image and display it in the
         *      list and in the infowindow
         * - extracts: We get a maximum of 300 caracters as a sample from
         *      the Wikipedia page
         * - info: To get the full URL to the Wikipedia page
         */
        $.getJSON(wikipedia_api_url + '?callback=?', {
                action: 'query',
                prop: 'coordinates|pageimages|extracts|info',
                exintro: 1,
                exchars: 300,
                inprop: 'url',
                format: 'json',
                titles: place_to_visit,
            }, function(data) {
                try{
                    // Get the page from the API and create a new MarkerPlace
                    // object, then add it to the list
                    var pageId = Object.keys(data.query.pages)[0];
                    var page = data.query.pages[pageId];
                    placesList.items.push(new MarkerPlace(page));

                    // Once we complete processing this page, we clear the
                    // error timer
                    window.clearTimeout(jsonpError);
                }
                catch (err) {
                    /*
                     * Let the jsonpError timeout display the error message.
                     * It will work for all these cases:
                     * - The API returned invalid JSON data
                     * - The API returned missing data
                     *  (an exception was thrown in MarkerPlace class)
                     * - We didn't get a response in less than 2 seconds
                     */
                }

            })
            .always(function() {
                // Hide the loading gif after processing the last page
                if (index === places_to_visit.length - 1) {
                    placesList.finishedLoading();
                }
            });
    });
}

/*
 * Knockout classes
 */

// MarkerPlace ViewModel
var MarkerPlace = function(page) {
    var self = this;

    self.page = page;

    // Create a Marker at the coordinates of the page
    self.marker = new google.maps.Marker({
        map: map,
        position: new google.maps.LatLng(self.page.coordinates[0].lat,
            self.page.coordinates[0].lon),
        title: self.page.title,
    });

    // Initially, the item is visible
    self.is_visible = ko.observable(true);
    // Subscrite to is_visible obsverable to control visibility in the list
    // and on the map with a single call
    self.is_visible.subscribe(function (newValue) {
        if (newValue) {
            self.marker.setMap(map);
        }
        else{
            self.marker.setMap(null);
        }
    });

    // Get the image of the page, use the flag of Monaco if it is not available
    self.default_img_url = 'http://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Flag_of_Monaco.svg/200px-Flag_of_Monaco.svg.png';
    if (self.page.hasOwnProperty('thumbnail')) {
        self.imgUrl = ko.observable(page.thumbnail.source.replace(/\d+px/, '200px'));
    } else {
        self.imgUrl = ko.observable(self.default_img_url);
    }

    // Function to display the infowindow on this marker
    self.displayInfoWindow = function() {
        infowindow.close();

        // Load the infowindowTemplate and fill it with this marker's info
        var infowindowContent = $("#infowindowTemplate").html()
                                    .replace("{{pageTitle}}", self.page.title)
                                    .replace("{{imgUrl}}", self.imgUrl())
                                    .replace("{{pageExtract}}", self.page.extract)
                                    .replace("{{pageFullUrl}}", self.page.fullurl);

        infowindow.setContent(infowindowContent);

        infowindow.open(map, self.marker);
    };

    // Attach the displayInfoWindow to the click event of the marker
    google.maps.event.addListener(self.marker, 'click', self.displayInfoWindow);

    // Hide/show the marker depending the keyword
    self.filter = function (keyword) {
        if (self.page.title.toLowerCase().indexOf(keyword.toLowerCase()) !== -1){
            self.is_visible(true);
        }
        else{
            self.is_visible(false);
        }
    };
};

// PlacesList ViewModel
var PlacesList = function() {
    var self = this;
    // List items
    self.items = ko.observableArray([]);

    // Filter keyword
    self.keyword = ko.observable("");

    // Currently selected items
    self.selectedItems = ko.observableArray([]);

    // Error messages
    self.errorMessages = ko.observableArray([]);

    // Is the currently collapsed or expanded ?
    self.isCollapsed = ko.observable(false);

    // Is the currently loading ?
    self.isLoading = ko.observable(false);

    self.startedLoading = function () {
        self.isLoading(true);
    };

    self.finishedLoading = function () {
        window.setTimeout(function () {self.isLoading(false);}, 2000);
    };

    self.filterList = function(keyword) {
        self.items().forEach(function(item) {
            item.filter(keyword);
        });
    };

    self.toggleList = function() {
        self.isCollapsed(!self.isCollapsed());
    };

    self.keyword.subscribe(function (newValue) {
        self.filterList(newValue);
    });

    self.selectedItems.subscribe(function(newValue) {
        self.toggleList();
        self.items()[newValue[0]].displayInfoWindow();
    });
};

/*
 * Initialization
 */
$(function() {
    // Create a new PlacesList and start loading
    placesList = new PlacesList();
    ko.applyBindings(placesList);

    placesList.startedLoading();

    try {
        initialize_map();
    } catch (err) {
        // Display an error message if an exception is thrown
        // while initializing the map
        placesList.errorMessages.push("Cannot load Google Map.");
        placesList.finishedLoading();
    }
});
