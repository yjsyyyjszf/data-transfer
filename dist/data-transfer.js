angular.module('data-transfer', ['ui.bootstrap']); // Creation of the main module of the framework
;
angular.module('data-transfer')

	.factory('browserDetectionService', function () {
		return {
			isChrome: function () {
				var chrome,
					// Code copied from internet (http://stackoverflow.com/questions/4565112/javascript-how-to-find-out-if-the-user-browser-is-chrome)	
					isChromium = window.chrome,
					winNav = window.navigator,
					vendorName = winNav.vendor,
					isOpera = winNav.userAgent.indexOf("OPR") > -1,
					isIEedge = winNav.userAgent.indexOf("Edge") > -1,
					isIOSChrome = winNav.userAgent.match("CriOS"),
					message = document.getElementById("dropMessage");

				if (isIOSChrome) {
					chrome = true;
				} else if (isChromium !== null && isChromium !== undefined && vendorName === "Google Inc." && isIEedge === false) {
					chrome = true;
				} else {
					chrome = false;
				}

				return chrome;
			}
		};
	});
;
angular.module('data-transfer')

	.factory('configService', function () {
		var settings; // Object that stores all settings
		// Ajax request to settings.json file. Get settings in json format
		$.ajax({
			url: '/dataTransfer/src/js/settings.json',
			async: false,
			dataType: 'json',
			success: function (response) {
				settings = response;
			}
		});

		return {
			// Function that returns if the dropped file should upload automatically (boolean)
			getAutoStart: function () {
				return settings.autoStart;
			},
			// Function that returns the number of time a failed upload should retry automatically (number)
			getAutoRetriesQty: function () {
				return settings.autoRetriesQty;
			},
			// Function that returns the number of transfers that can run at the same time (number)
			getConcurentTransfersQty: function () {
				return settings.concurentTransfersQty;
			},
			// Function that returns URL of the API endpoint (string)
			getApiEndpointURL: function () {
				return settings.apiEndpointURL;
			},
			// Function that returns the number of transfers that are displayed on the same page in the view (number)
			getDisplayedTransfersQty: function () {
				return settings.displayedTransfersQty;
			}
		};
	});
;
angular.module('data-transfer')

	.factory('mockService', ['$timeout', function ($timeout) {
		var transfers = []; // Array of transfers
		return {
			// Function that uploads a file
			uploadFile: function (file) {
				transfers.push(file); // Add the file to the transfers array
				var prog = file.prog; // Progress 
				var time;
				if (file.time !== undefined) {
					time = file.time; // Elapsed time of the upload 
				}
				else {
					time = 0;
				}
				var complete = false; // Indicates if the upload is complete
				var timeout; // Duration of the upload (changes depending to the name of the file)
				var finishedSent = false; // Indicates if finished event has been sent. Allows to send it only once.
				var status; // Status which is set depending to the name of the file

				// Events
				var progress = $.Event('progress'); // Sent every 100ms to update progress
				var finished = $.Event('complete'); // Sent when upload is complete (when time = timeout)

				// Interval that executes a function each 100 ms
				var interval = setInterval(function () {
					var index = transfers.lastIndexOf(file); // Get the index of the file in transfers array
					if (index !== -1) { // If file exists in array
						if (file.status === 'Failed') { // If the up has failed (retry)
							file.status = 'Pending'; // Status is now pending
						}
						if (transfers[index].status === 'Queued') { // If the upload has not been started yet
							time = 0; // Set time to 0
						}
						if (transfers[index].status === 'Pending') { // If the upload is pending (running)
							time += 100; // 100 ms seconds has passed sinces last interval
						}
						prog = (time / timeout) * 100; // Progress in percent
						progress.prog = prog; // Affect this progress to the event
						progress.file = file; // Affect the file to the event
						progress.elapsedTime = time / 1000 + ' s'; // Elapsed time (in seconds)
						progress.time = time;
						complete = time > timeout; // Check if upload is complete
						progress.remainingTime = (timeout - time) / 1000 + ' s'; // Remaining time is timeout - time (in seconds)
						progress.state = transfers[index].status; // State of the progress event is the status of the running transfer
						if (!complete) { // If transfer is not complete
							$(window).trigger(progress); // Trigger the progress event
						}
						// If upload is complete
						else if (!finishedSent) { // And finished event hadn't been sent 
							finished.state = status; // Set state of the finished event
							finished.file = file; // Set the file that is concerned by this event
							index = transfers.indexOf(file); // Index of the file in the transfers array
							transfers.splice(index, 1); // Remove file from transfers array
							finishedSent = true; // Finished event has been sent
							clearInterval(interval); // Clear this interval
							$(window).trigger(finished); // Trigger the finished event
						}
					}
				}, 100);

				// Check if the name of the file contains 'success'
				if (file.name.indexOf('success') !== -1) {
					timeout = 2000; // Set timeout to 2 seconds
					status = 'Succeeded'; // Status is Succeeded
				}
				// Check if the name of the file contains 'error'
				else if (file.name.indexOf('error') !== -1) {
					timeout = 3000; // Set timeout to 3 seconds
					status = 'Failed'; // Status is Failed
				}
				// If the name of the file contains neither 'succes' or 'error'
				else {
					timeout = 5000; // Set timeout to 5 seconds
					status = 'Failed'; // Status is Failed
				}
			},
			// Function that suspends the upload
			pause: function (trans) {
				var index = transfers.indexOf(trans); // Get the index of the file in the transfers array
				transfers[index].status = 'Paused'; // Set status to Paused
			},
			// Function that resumes the upload
			resume: function (trans) {
				var index = transfers.indexOf(trans); // Get the index of the file in the transfers array
				if (index !== -1) {
					transfers[index].status = 'Pending'; // Set status to Pending
				}
				else {
					trans.status = 'Pending';
					this.uploadFile(trans);
				}
			},
			// Function that stops the upload
			stop: function (trans) {
				var index = transfers.indexOf(trans); // Get the index of the file in the transfers array
				if (index !== -1) {
					transfers[index].status = 'Queued'; // Set status to Queued
				}
				else {
					trans.status = 'Queued';
					trans.time = 0;
					trans.prog = 0;
					trans.elapsedTime = '';
					trans.remainingTime = '';
				}
			}
		};
	}]);
;
angular.module('data-transfer')

	.factory('serviceFactory', ['uploadService', 'mockService', function (uploadService, mockService) {

		return {
			// Function that returns either mockService or uploadService, depending on the value of service argument
			getService: function (service) {
				var returnedService = {}; // Service that will be returned
				switch (service) {
					case 'mock': // If the parameter is 'mock'
						returnedService = mockService; // Return mockService
						break;
					case 'upload': // If the parameter is 'upload'
						returnedService = uploadService; // Return uploadService
						break;
					default: // In each other case
						returnedService = mockService; // Return mockService
						break;
				}

				return returnedService;
			}
		};
	}]);
;
angular.module('data-transfer')

	.factory('transfersService', ['serviceFactory', 'configService', function (serviceFactory, configService) {

		var files = [];
		var autoRetries = [];
		var filePushed = $.Event('filePushed');
		var service = serviceFactory.getService('upload');
		var runningTransfers = [];
		var concurentTransfers = configService.getConcurentTransfersQty(); // Get the number of transfers that can run at the same time
		var transfersCompleted = 0; // Number of completed transfers

		var run = $.Event('run');
		run.state = 'Pending';

		// Event triggered by the service when an upload is finished
		$(window).on('complete', function (e) {
			var index = files.indexOf(e.file); // Get the index of the file in the transfers array
			var offset = concurentTransfers - 1; // Offset for the index to get the next transfer
			if (e.state == 'Succeeded') { // If upload has succeeded
				transfersCompleted++; // Incerment the counter of completed transfers
				if (transfersCompleted < files.length - offset) { // If there is still queued transfers
					runningTransfers.splice(index, 1); // Remove succeeded transfer from running transfers array
					if (configService.getAutoStart()) { // If upload should start automatically
						runningTransfers.push(files[transfersCompleted + offset]); // Add next queued transfer to running transfers array
						service.uploadFile(files[transfersCompleted + offset]); // Run this transfer
						run.file = files[transfersCompleted + offset];
						$(window).trigger(run);
					}
				}
			}
			else if (e.state == 'Failed') {
				if (autoRetries[index] < configService.getAutoRetriesQty()) {
					service.uploadFile(e.file);
					run.file = e.file;
					$(window).trigger(run);
					autoRetries[index]++;
				}
				else {
					transfersCompleted++;
					if (configService.getAutoStart() && transfersCompleted + offset < files.length) {
						service.uploadFile(files[transfersCompleted + offset]); // Run this transfer
						run.file = files[transfersCompleted + offset];
						$(window).trigger(run);
					}
				}
			}
		});

		return {
			pushFile: function (file) {
				files.push(file);
				autoRetries.push(0);
				var service = serviceFactory.getService('upload');
				filePushed.status = configService.getAutoStart() ? 'Pending' : 'Queued';
				filePushed.file = file;
				$(window).trigger(filePushed);
				if (configService.getAutoStart()) {
					this.start(file);
				}
			},
			getFiles: function () {
				return files;
			},
			start: function (file) {
				if (runningTransfers.length < concurentTransfers) {
					runningTransfers.push(file);
					service.uploadFile(file);
					run.file = file;
					$(window).trigger(run);
				}
			},
			getRunningTransfers: function () {
				return runningTransfers;
			}
		};

	}]);
;
angular.module('data-transfer')

	.factory('uploadService', ['$http', 'configService', function ($http, configService) {
		var acceptedExtensions = ['*'];
		var url = configService.getApiEndpointURL();
		return {
			uploadFile: function (file) {
				var uploadFormData = new FormData();
				uploadFormData.append('file', file);
				$http.defaults.headers.common.Authorization = 'Basic ZGVtb0B2aXJ0dWFsc2tlbGV0b24uY2g6ZGVtbw==';

				$http.post(url, uploadFormData, {
					transformRequest: angular.identity,
					headers: { 'Content-Type': undefined }
				})
					.success(function (response) {
						var finished = $.Event('complete'); // Sent when upload is complete (when time = timeout)
						finished.file = file;
						finished.state = 'Succeeded';
						$(window).trigger(finished); // Trigger the finished event
					})
					.error(function (response) {
						var finished = $.Event('complete'); // Sent when upload is complete (when time = timeout)
						finished.file = file;
						finished.state = 'Failed';
						$(window).trigger(finished); // Trigger the finished event
					});
			}
		};
	}]);
;
angular.module('data-transfer')

	.controller('dropController', ['$scope', 'browserDetectionService', 'transfersService', function ($scope, browserDetectionService, transfersService) {
		var chrome = browserDetectionService.isChrome();
		var files = [];
		// Display the message in the drop zone
		if (chrome) {
			document.getElementById("dropMessage").innerHTML = "Drag n'drop your files or folders here";
		}
		else {
			document.getElementById("dropMessage").innerHTML = "Drag n'drop your files here";
		}

		var dropZone = document.getElementById("dropZone");

		// onDragover event of the dropZone
		dropZone.ondragover = function (ev) {
			ev.preventDefault(); // Prevent dropped file to be openned in the browser
		};

		function pushFile(file) {
			var alreadyDropped = false;
			for (var i = 0; i < transfersService.getFiles().length; i++) {
				if (transfersService.getFiles()[i].name === file.name) {
					alreadyDropped = true;
					alert('File alreadyDropped: ' + file.name);
					i = transfersService.getFiles().length;
				}
			}
			if (!alreadyDropped) {
				transfersService.pushFile(file);
			}
		}

		// onDrop event of the dropZone
		dropZone.ondrop = function (ev) {
			ev.preventDefault(); // Prevent dropped file to be openned in the browser
			var droppedFiles = chrome ? ev.dataTransfer.items : ev.dataTransfer.files; // Dropped files array affected depending on the browser
			for (var i = 0; i < droppedFiles.length; i++) {
				if (chrome) {
					var entry = droppedFiles[i].webkitGetAsEntry();
					if (entry.isDirectory) {
						$scope.scanDirectory(entry);
					}
					else if (entry.isFile) {
						files.push(entry);
						entry.file(pushFile);
					}
				}
				else {
					files.push(droppedFiles[i]);
					transfersService.pushFile(droppedFiles[i]);
				}
			}
		};

		// Function that scans the directory recursively, until it contains only files
		$scope.scanDirectory = function (item) {
			var directoryReader = item.createReader(); // A directory reader is needed to scan the directory

			directoryReader.readEntries(function (entries) { // Read all entries of the directory (can be file or directory)
				entries.forEach(function (entry) { // Go through all entries
					if (entry.isDirectory) { // If it's a directory
						$scope.scanDirectory(entry); // Scan it (recursion)
					}
					else if (entry.isFile) { // If it's a file
						files.push(entry); // Read it as text
						entry.file(pushFile);
					}
				});
			});
		};
	}]);
;
angular.module('data-transfer')

	.controller('viewController', ['$scope', 'configService', 'transfersService', function ($scope, configService, transfersService) {

		var files = [];
		var filesVM = [];
		var runningTransfers = [];
		$scope.displayedTransfers = [];
		var currentPage = 1;

		$(window).on('filePushed', function (e) {
			files.push(e.file);
			runningTransfers = transfersService.getRunningTransfers();
			var sta = 'Queued';
			for (var i = 0; i < runningTransfers.length; i++) {
				if (runningTransfers[i].name == e.file.name) {
					sta = 'Pending';
					i = runningTransfers.length;
				}
			}
			var newFileVM = {
				name: e.file.name,
				size: e.file.size,
				displaySize: function () {
					var cptDiv = 0;
					var size = this.size;
					while (size > 1024) {
						size /= 1024;
						cptDiv++;
					}
					return (Number((size).toFixed(0))) + (cptDiv == 2 ? ' MB' : cptDiv == 1 ? ' KB' : ' B');
				},
				status: sta,
				transferType: 'Upload'
			};
			filesVM.push(newFileVM);
			$scope.displayedTransfers.push(newFileVM);
			$scope.definePagination();
			$scope.changePage(currentPage);
			$scope.$apply();
		});

		$(window).on('run', function (e) {
			var index = files.indexOf(e.file);
			filesVM[index].status = e.state;
		});

		$(window).on('complete', function (e) {
			var index = files.indexOf(e.file); // Get the index of the file in the transfers array
			filesVM[index].status = e.state;
		});

		$scope.start = function (trans) {
			var index = filesVM.indexOf(trans);
			transfersService.start(files[index]);
			filesVM[index].status = 'Pending';
		};

		// Function that changes the page of the table (by changing displayed transfers)
		// num: number of the page to display
		$scope.changePage = function (num) {
			if (num !== 0)
				currentPage = num; // Change currentPage
			$scope.displayedTransfers = []; // Flushing displayed transfers array
			var displayedQty = configService.getDisplayedTransfersQty();
			transfers = filesVM;
			// Loop that adds the correct number of transfers into the displayedTransfers array
			for (var i = 0, trans = (currentPage - 1) * 5; i < displayedQty; i++ , trans++) {
				if (transfers[trans] !== undefined) { // If the current transfer exist
					if ($scope.page != 'upload' || transfers[trans].transferType == 'Upload') { // Check conditions to display current transfer (page different than "upload" or transfer type is "Upload")
						$scope.displayedTransfers.push(transfers[trans]); // Affect the current displayedTransfer
					}
					else { // If transfer shouldn't be displayed
						i--; // Decrement i. It has for effect to stay at the same index in the display array
					}
				}
				else // If the transfer doesn't exisit
					i = displayedQty; // Go out of the loop
			}
		};

		$scope.definePagination = function () {
			var displayedQty = configService.getDisplayedTransfersQty();
			$scope.pageCount = (filesVM.length / displayedQty) + 1; // Calculate number of pages from number of transfers to display
			// init bootpag
			$('#page-selection').bootpag({
				total: $scope.pageCount,
				maxVisible: displayedQty,
				firstLastUse: true,
				first: '←',
				last: '→',
			})
				// When the user navigates in the pagination
				.on("page", function (event, num) {
					$scope.changePage(num); // Change the current page
					$scope.$apply(); // Apply changes to be displayed on the view
				});
			if ($scope.page != 'upload') // If the page is not "upload"
				$scope.defineBodyPadding(); // Define bottom padding of the body
		};

		// Function that defines the bottom padding of the body. The goal is to always have the body above the transfers view in home page
		$scope.defineBodyPadding = function () {
			var body = $("body"); // Get the body with jQuery		
			body.css("padding-bottom", fileTransfersView.css("height")); // Bottom padding is equals to transfers view height
		};

		var fileTransfersView = $("#fileTransfersView"); // Get the view with jQuery
		var imgChevronCollapse = $("#imgChevronCollapse"); // Get icon with jQuery

		// Detects when the user click on the chevron icon of the transfers view
		imgChevronCollapse.on('click', function () {
			// Change the class to display an up or a down chevron (up when view is collapsed)
			if (imgChevronCollapse.hasClass("fa-chevron-down")) {
				imgChevronCollapse.removeClass("fa-chevron-down");
				imgChevronCollapse.addClass("fa-chevron-up");
			}
			else if (imgChevronCollapse.hasClass("fa-chevron-up")) {
				imgChevronCollapse.removeClass("fa-chevron-up");
				imgChevronCollapse.addClass("fa-chevron-down");
			}
		});

		// When the view is collapsed
		fileTransfersView.on("hidden.bs.collapse", function () {
			if ($scope.page != 'upload')
				$scope.defineBodyPadding();
		});

		// When the view is shown
		fileTransfersView.on("shown.bs.collapse", function () {
			if ($scope.page != 'upload')
				$scope.defineBodyPadding();
		});

		// Event that is emitted when the ng-repeat directive (which displays all transfers that must be displayed) has finish to display all transfers			
		$scope.$on('ngRepeatFinished', function (ngRepeatFinishedEvent) {
			if ($scope.page != 'upload') // If the page isn't "upload"
				$scope.defineBodyPadding(); // Define the padding of the body
		});
	}])
	// Directive that fires an event when ng-repeat is finished
	// (found on the internet: http://stackoverflow.com/questions/15207788/calling-a-function-when-ng-repeat-has-finished)
	.directive('onFinishRender', function ($timeout) {
		return {
			restrict: 'A',
			link: function (scope, element, attr) {
				if (scope.$last === true) {
					$timeout(function () {
						scope.$emit(attr.onFinishRender);
					});
				}
			}
		};
	});