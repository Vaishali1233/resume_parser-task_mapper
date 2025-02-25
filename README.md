# 📌 Resume Parser & Task Mapper
🚀 An AI-powered resume processing & task assignment system that automates candidate evaluation and workflow management using Python, Flask, GCP, and Google App Scripts.

## 🔹 Overview
This project streamlines resume processing, candidate evaluation, and automated task assignment. It integrates Flask APIs, Google Sheets, and Cloud Functions to enhance hiring efficiency.

- Resume Parsing: Extracts structured data (Name, Email, Skills, Experience) from resumes.
- Task Mapping: Dynamically assigns tasks to employees based on skill matching.
- Google Sheets Integration: Automates data storage using Google App Scripts.
- Cloud Deployment: Hosted on Google Cloud Functions for real-time automation.

## 🔧 Tech Stack
- Backend: Python, Flask
- Cloud & Automation: Google Cloud Functions, Google App Scripts
- Database: Google Sheets (used as a structured database)
- APIs: Gmail API, Google Drive API
- Scripting: JavaScript (Google App Scripts), Python

### 🚀 Features
1️⃣ Resume Parsing
- Extracts key details from resumes using NLP techniques.
- Stores structured data in Google Sheets via API integration.
- Supports multiple file formats (PDF, DOCX).

2️⃣ Task Mapping & Workflow Automation
- Dynamically maps tasks to employees based on their skills.
- Uses Levenshtein Distance Algorithm for skill similarity matching.
- Generates real-time reports for task tracking and efficiency.

3️⃣ Google Sheets & Email Automation
- Fetches candidate and employee details automatically.
- Sends automated email notifications for assigned tasks.

### 🛠️ Setup & Deployment
- Clone the Repository: cd resume_parser-task_mapper
- Install Dependencies: pip install -r requirements.txt
- Configure Google Cloud & App Scripts: Enable Google Cloud APIs (Cloud Functions, Sheets, Gmail API). Deploy Google App Scripts for automation. Run Flask backend for local processing.
- Run the Flask Backend: python app.py
