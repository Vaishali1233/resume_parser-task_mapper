function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Candidate Data')
    .addItem('Run Resume Parser', 'callProcessResumes')
    .addItem('Upload Google Sheet', 'promptUploadLink')
    .addItem('Custom Header Mapping', 'showHeaderMappingPopup')
    .addToUi();

  if(shouldRunAutomatically()){
    callProcessResumes();
  }
}

function promptUploadLink() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Upload Sheet', 'Enter the link of the sheet to be uploaded:', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() == ui.Button.OK) {
    const sheetLink = response.getResponseText();
    if (isValidURL(sheetLink)) {
      ui.alert('Sheet link uploaded successfully');
      processUploadedSheet(sheetLink);
    } else {
      ui.alert('Invalid URL. Please enter a valid link.');
    }
  }
}

function processUploadedSheet(sheetLink) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const uploadedSheet = SpreadsheetApp.openByUrl(sheetLink).getSheets()[0];
    const candidateSheet = ss.getSheetByName("Candidate");

    if (!uploadedSheet || !candidateSheet) {
      SpreadsheetApp.getUi().alert("Could not access sheets.");
      return;
    }

    let uploadedDataSheet = ss.getSheetByName("Uploaded Candidate Data");
    if (!uploadedDataSheet) {
      uploadedDataSheet = ss.insertSheet("Uploaded Candidate Data");
    } else {
      uploadedDataSheet.clear();
    }

    const allData = uploadedSheet.getDataRange().getValues();
    const headers = allData[0];  
    const dataRows = allData.slice(1); 

    uploadedDataSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    if (dataRows.length > 0) {
      uploadedDataSheet.getRange(2, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
    }

    console.log("Uploaded Sheet Headers: ", headers);

  } catch (error) {
    SpreadsheetApp.getUi().alert("Error processing uploaded sheet: " + error.message);
  }
}

function shouldRunAutomatically() {
  var configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
  var userChoice = configSheet.getRange("B2").getValue();
  return userChoice.toString().trim().toLowerCase() === "automatic";
}

function runResumeParser() {
  callProcessResumes();
}

function onEdit(e) {
  if (!e || !e.source) return;
  var sheet = e.source.getActiveSheet();
  var range = e.range;

  if (sheet.getName() === "Config") return;
  if (sheet.getName() !== "Candidate") return;

  var resumeColIndex = getColumnIndex("Resume", sheet);
  if (resumeColIndex === -1) return;
  if (range.getColumn() !== resumeColIndex) return;

  var newValue = range.getValue();
  if (!isValidURL(newValue)) return;

  var configSheet = e.source.getSheetByName("Config");
  if (!configSheet) return;

  var mode = configSheet.getRange("B2").getValue().toString().trim().toLowerCase();
  if (mode === "automatic") {
    callProcessResumes();
  }
}

function isValidURL(str) {
  var pattern = /^(https?:\/\/[^\s]+)/;
  return pattern.test(str);
}

function callProcessResumes() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log("Another instance is running. Exiting.");
    return;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Candidate");
    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");

    if (!sheet || !configSheet) return;

    var resumeColIndex = getColumnIndex("Resume", sheet);
    if (resumeColIndex === -1) return;

    var lastParsedRow = configSheet.getRange("B3").getValue();
    if (!lastParsedRow || isNaN(lastParsedRow)) lastParsedRow = 1;

    var data = sheet.getDataRange().getValues();
    var newLastParsedRow = lastParsedRow;

    const resumeParserUrl = "https://dash.infinityfree.com/accounts/if0_38324794/domains/ngrokpersonal.free.nf";

    const options = {
      method: 'post',
      muteHttpExceptions: true
    };

    for (var i = lastParsedRow; i < data.length; i++) {
      var resumeURL = data[i][resumeColIndex - 1];
      if (isValidURL(resumeURL)) {
        const response = UrlFetchApp.fetch(resumeParserUrl, options);
        if (response.getResponseCode() === 200) {
          const jsonResponse = JSON.parse(response.getContentText());
          const successCount = jsonResponse.success_count || 0;
          const failureCount = jsonResponse.failure_count || 0;

          newLastParsedRow = i + 1;

          SpreadsheetApp.getUi().alert(`Resume parsing completed successfully!\n\nSuccess: ${successCount}\nFailures: ${failureCount}`);
        } else {
          const jsonResponse = JSON.parse(response.getContentText());
          SpreadsheetApp.getUi().alert(`Failed to run the resume parser.\nError: ${jsonResponse.error || "Unknown error"}`);
        }
      }
    }
    configSheet.getRange("B3").setValue(newLastParsedRow);
  } catch (error) {
    SpreadsheetApp.getUi().alert(`An error occurred: ${error.message}`);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
    try {
        var content = generateReport();
        var fileName = "Candidate_Report.txt";
        
        var file = DriveApp.createFile(fileName, content, MimeType.PLAIN_TEXT);
        var fileUrl = file.getDownloadUrl();
        
        return HtmlService.createHtmlOutput(`
            <html>
            <head>
                <script>
                    window.onload = function() {
                        window.location.href = "${fileUrl}";
                    };
                </script>
            </head>
            <body>
                <p>Your download should start automatically. If not, <a href="${fileUrl}">click here</a>.</p>
            </body>
            </html>
        `);
    } catch (e) {
        return HtmlService.createHtmlOutput("Error: " + e.message);
    }
}

function generateReport() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mainSheet = ss.getSheetByName("Candidate");
    if (!mainSheet) return "Error: 'Candidate' sheet not found.";

    var headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
    var ratingColumns = ["Name", "Rating 1", "Rating 2", "Rating 3", "Rating 4", "Rating 5", "Remarks"];
    var columnIndexes = ratingColumns.map(name => headers.indexOf(name) + 1).filter(index => index > 0);
    
    if (columnIndexes.length === 0) return "No rating/remarks columns found.";

    var data = mainSheet.getDataRange().getValues();
    var reportContent = "Candidate Report\n\n";

    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var candidateData = columnIndexes.map(idx => row[idx - 1] || "-");
        if (candidateData.some(cell => cell !== "-")) {
            reportContent += `Candidate ${i}:\n`;
            ratingColumns.forEach((colName, index) => {
                reportContent += `${colName}: ${candidateData[index]}\n`;
            });
            reportContent += "\n-----------------------\n";
        }
    }
    return reportContent;
}

function openDownloadPage() {
  var url = "https://script.google.com/macros/s/AKfycbzNzh6ynIpylK4TO8jGiIXqAJDym-n4p_xrJA4HkPn4EDEtL-8AMXJiZWLbMavb8zaZ/exec"; 
  var html = `<script>window.open('${url}', '_blank');</script>`;
  return HtmlService.createHtmlOutput(html);
}

function openWebApp() {
  var webAppUrl = "https://script.google.com/macros/s/AKfycbxTAA2QuOQCEpNa6l2N9ATP9cWWXPytBACMbyeY4-QKQD_UHRxT33OgIuwT4ied9uCkyg/exec";
  var html = `<script>window.open('${webAppUrl}', '_blank');</script>`;
  return HtmlService.createHtmlOutput(html);
}

function getHeadersForMapping(sheetLink) {
  try {
    var ss = SpreadsheetApp.openByUrl(sheetLink); 
    var uploadedSheet = ss.getSheetByName("Uploaded Candidate Data");
    var candidateSheet = ss.getSheetByName("Candidate");

    if (!uploadedSheet || !candidateSheet) {
      Logger.log("Error: One or both sheets are missing.");
      return { error: "One or both sheets are missing." };
    }

    var uploadedHeaders = uploadedSheet.getRange(1, 1, 1, uploadedSheet.getLastColumn()).getValues()[0];
    var candidateHeaders = candidateSheet.getRange(1, 1, 1, candidateSheet.getLastColumn()).getValues()[0];

    Logger.log("Uploaded Headers: " + JSON.stringify(uploadedHeaders));
    Logger.log("Candidate Sheet Headers: " + JSON.stringify(candidateHeaders));

    return { uploadedHeaders: uploadedHeaders, candidateHeaders: candidateHeaders };
  } catch (e) {
    Logger.log("Error fetching headers: " + e.message);
    return { error: "Error fetching headers: " + e.message };
  }
}

function showHeaderMappingPopup() {
  var htmlTemplate = HtmlService.createHtmlOutputFromFile('HeaderMappingUI')
      .setTitle("Map Headers");
  SpreadsheetApp.getUi().showSidebar(htmlTemplate);
}

function getHeaders() {
  var sourceHeaders = getHeadersFromSheet("Uploaded Candidate Data");
  var destinationHeaders = getHeadersFromSheet("Candidate");

  return { source: sourceHeaders, destination: destinationHeaders };
}

function getHeadersFromSheet(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];

  var lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) return []; 
  
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0] || []; 
}

function applyHeaderMapping(mapping) {
  var sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Uploaded Candidate Data");
  var destinationSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Candidate");

  if (!sourceSheet || !destinationSheet) {
    Logger.log("Error: One or both sheets are missing.");
    return;
  }

  var sourceHeaders = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
  var destinationHeaders = destinationSheet.getRange(1, 1, 1, destinationSheet.getLastColumn()).getValues()[0];

  var sourceData = sourceSheet.getDataRange().getValues();
  var destinationData = destinationSheet.getDataRange().getValues();

  if (Object.keys(mapping).length === 0) {
    Logger.log("Error: No headers mapped.");
    return;
  }

  var newRows = [];
  var mappingArray = Object.entries(mapping); 
  var candidateIdColIndex = destinationHeaders.indexOf("Candidate ID");

  var lastRow = destinationSheet.getLastRow();
  var maxCandidateId = 0;
  if (lastRow > 1) {  
    var existingIds = destinationSheet.getRange(2, candidateIdColIndex + 1, lastRow - 1, 1).getValues().flat();
    var numericIds = existingIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    if (numericIds.length > 0) {
      maxCandidateId = Math.max(...numericIds);
    }
  }

  for (let i = 1; i < sourceData.length; i++) {
    let newRow = new Array(destinationHeaders.length).fill("");

    if (candidateIdColIndex !== -1) {
      maxCandidateId++;
      newRow[candidateIdColIndex] = maxCandidateId;
    }

    mappingArray.forEach(([source, destination]) => {
      let sourceIndex = sourceHeaders.indexOf(source);
      let destinationIndex = destinationHeaders.indexOf(destination);
      if (sourceIndex !== -1 && destinationIndex !== -1) {
        newRow[destinationIndex] = sourceData[i][sourceIndex];
      }
    });
    newRows.push(newRow);
  }

  if (newRows.length > 0) {
    destinationSheet.getRange(destinationSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  } else {
    Logger.log("Warning: No data was transferred.");
  }
}
