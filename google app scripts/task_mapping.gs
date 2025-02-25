function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Task Mapper')
    .addItem('Run Task Mapping', 'runTaskProcessor')
    .addToUi();
  
  if (shouldRunAutomatically()) {
    runTaskProcessor();
  }
}

function shouldRunAutomatically() {
  var configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
  if (!configSheet) return false;
  
  var userChoice = configSheet.getRange("B2").getValue();
  return userChoice.toLowerCase() === "automatic";
}

function runTaskProcessor() {
  mapProfilesToTasks();
  taskmapping();
}

function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var range = e.range;
  
  if (sheet.getName() === "Tasks Masterdata") {
    var editedColumn = range.getColumn();
    var taskNameColumn = 2; 
    var taskDescColumn = 3; 
    
    if (editedColumn === taskNameColumn || editedColumn === taskDescColumn) {
      if (shouldRunAutomatically()) {
        runTaskProcessor();
      }
    }
  }
}

//TO FIND THE AI MAPPING OF PROFILES
function mapProfilesToTasks() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tasks Masterdata");
  var data = sheet.getDataRange().getValues();
  
  var headerRow = data[0];
  var taskNameIndex = headerRow.indexOf("Task Name");
  var taskDescIndex = headerRow.indexOf("Task Desc");
  var profileColumnIndex = headerRow.indexOf("Master profile");
  var aiMappingIndex = headerRow.indexOf("AI Mapping of Profiles (Task, Desc, Attachments)");

  if (taskNameIndex === -1 || taskDescIndex === -1 || aiMappingIndex === -1 || profileColumnIndex === -1) {
    Logger.log("Columns not found! Ensure the column headers are correct.");
    return;
  }

  var profileMapping = {
    "SDE": ["software", "developer", "engineer", "architecture", "backend", "frontend", "programming", "coding"],
    "Data Analyst": ["data", "analytics", "business intelligence", "machine learning", "big data"],
    "Cloud Engineer": ["cloud", "infrastructure", "devops", "networking", "kubernetes", "aws", "gcp", "azure"],
    "Growth": ["marketing", "growth", "engagement", "seo", "advertising"],
    "Product Manager": ["product", "manager", "strategy", "roadmap", "market analysis"],
    "Security Engineer": ["security", "cybersecurity", "compliance", "encryption", "hacking"],
    "Database Administrator": ["database", "sql", "nosql", "mongodb", "postgresql", "mysql"],
    "Business Development": ["business", "sales", "partnerships", "expansion", "revenue"],
    "Community Manager": ["community", "collaboration", "engagement", "networking"],
    "UX Designer": ["user experience", "ux", "ui", "design", "figma"],
    "Tech Consultant": ["consulting", "solutions", "advisory", "optimization"]
  };

  var profiles = Object.keys(profileMapping);
  var profileDocs = profiles.map(profile => profileMapping[profile].join(" ")); 

  for (var i = 1; i < data.length; i++) {
    var taskText = (data[i][taskNameIndex] + " " + data[i][taskDescIndex]).toLowerCase();
    var bestMatchProfile = getBestProfileUsingTFIDF(taskText, profiles, profileDocs);

    if (bestMatchProfile) {
      data[i][profileColumnIndex] = bestMatchProfile;
      data[i][aiMappingIndex] = bestMatchProfile;
    }
  }

  sheet.getRange(2, profileColumnIndex + 1, data.length - 1, 1).setValues(data.slice(1).map(row => [row[profileColumnIndex]]));
  sheet.getRange(2, aiMappingIndex + 1, data.length - 1, 1).setValues(data.slice(1).map(row => [row[aiMappingIndex]]));
}

function getBestProfileUsingTFIDF(taskText, profiles, profileDocs) {
  var allDocs = [...profileDocs, taskText]; 
  var tfidfVectors = computeTFIDF(allDocs);

  var taskVector = tfidfVectors[tfidfVectors.length - 1]; 
  var bestMatchIndex = -1;
  var highestSimilarity = -1;

  for (var i = 0; i < profiles.length; i++) {
    var similarity = cosineSimilarity(tfidfVectors[i], taskVector);
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatchIndex = i;
    }
  }

  return bestMatchIndex !== -1 ? profiles[bestMatchIndex] : "General Task";
}

function computeTFIDF(docs) {
  var wordSet = new Set();
  var wordCounts = docs.map(doc => {
    var words = doc.match(/\b\w+\b/g) || [];
    var count = {};
    words.forEach(word => {
      word = word.toLowerCase();
      wordSet.add(word);
      count[word] = (count[word] || 0) + 1;
    });
    return count;
  });

  var wordsArray = Array.from(wordSet);
  var tfidfVectors = wordCounts.map(wordCount => {
    return wordsArray.map(word => {
      var tf = (wordCount[word] || 0) / Object.keys(wordCount).length;
      var idf = Math.log(docs.length / (docs.filter(d => d.includes(word)).length + 1)); 
      return tf * idf;
    });
  });

  return tfidfVectors;
}

function cosineSimilarity(vecA, vecB) {
  var dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
  var magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  var magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

  return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
}

function taskmapping() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var taskSheet = sheet.getSheetByName('Tasks Masterdata');
  var employeeSheet = sheet.getSheetByName('MD: Employees');
  var employeeMdSheet = sheet.getSheetByName('MD: Misc');
  var taskMdSheet = sheet.getSheetByName("MD: Task");

  var empData = employeeSheet.getDataRange().getValues();
  var taskData = taskSheet.getDataRange().getValues();
  var taskmdData = taskMdSheet.getDataRange().getValues();
  var empmdData = employeeMdSheet.getDataRange().getValues();

  var empHeaders = empData[0];
  var empRows = empData.slice(1);
  var taskHeaders = taskData[0];
  var taskRows = taskData.slice(1);

  var empMdHeaders = empmdData[1];
  var empmdRows = empmdData.slice(2);
  var taskMdHeaders = taskmdData[1];
  var taskmdRows = taskmdData.slice(2);

  var taskdescInd = taskHeaders.indexOf("Task Desc");
  var taskprofileInd = taskHeaders.indexOf("Master Profile");
  var taskskillInd = taskHeaders.indexOf("Skills");

  var skillsIndex = empHeaders.indexOf("Skills");
  var skillsetsIndex = empHeaders.indexOf("Skillsets");
  var profileInd = empHeaders.indexOf("Profile");
  var yoeInd = empHeaders.indexOf("Years of Experience");
  var leaveInd = empHeaders.indexOf("On Leave in the next 7 days");
  var pendingInd = empHeaders.indexOf("Pending / Upcoming Tasks");

  var taskWeights = {};
  var empWeights = {};

  taskmdRows.forEach((header, idx) => {
    var weight = taskmdRows[0][idx];
    if (weight) taskWeights[header] = weight;
  });

  empmdRows.forEach((header, idx) => {
    var weight = empmdRows[0][idx];
    if (weight) empWeights[header] = weight;
  });

  var assignedEmployeeIds = [];
  var assignedEmployeeNames = [];

  taskRows.forEach(task => {
    var taskProfile = task[taskprofileInd];
    var taskSkills = task[taskskillInd] ? task[taskskillInd].split(", ") : [];
    
    var empMatchScores = empRows.map(emp => {
      var matchScore = 0;

      empHeaders.forEach((key, index) => {
        if (key === "Profile") {
          matchScore += (emp[profileInd] === taskProfile ? 1 : 0) * (empWeights[key] || 1);
        } else if (key === "Years of Experience") {
          matchScore += (emp[yoeInd] || 0) * (empWeights[key] || 1);
        } else if (key === "On Leave in the next 7 days") {
          matchScore -= (emp[leaveInd] === "Yes" ? 1 : 0) * (empWeights[key] || 1);
        } else if (key === "Pending / Upcoming Tasks") {
          matchScore -= (emp[pendingInd] || 0) * (empWeights[key] || 1);
        } else if (key === "Skills" || key === "Skillsets") {
          var empSkills = new Set([
            ...(emp[skillsIndex] ? emp[skillsIndex].split(", ") : []),
            ...(emp[skillsetsIndex] ? emp[skillsetsIndex].split(", ") : [])
          ]);
          var skillMatch = taskSkills.filter(skill => empSkills.has(skill)).length;
          matchScore += skillMatch * (empWeights[key] || 1);
        }
      });

      return { 
        "Employee ID": emp[empHeaders.indexOf("Employee ID")], 
        "Name": emp[empHeaders.indexOf("Name")], 
        "Score": matchScore 
      };
    });

    empMatchScores.sort((a, b) => b.Score - a.Score);
    var topScores = empMatchScores.slice(0, 5);
    Logger.log(topScores);

    assignedEmployeeIds.push(topScores.map(e => e["Employee ID"]));
  });

  if (assignedEmployeeIds.length > 0) {
    taskSheet.getRange(2, 18, assignedEmployeeIds.length, 5).setValues(assignedEmployeeIds);
  }

  SpreadsheetApp.getUi().alert("Tasks processed and employees assigned successfully!");
}