
# Web Training Quiz App

A pure HTML, CSS, and JavaScript quiz application for web training sessions with real-time multiplayer functionality.

## Features

- **Admin/Instructor Mode**: Create quiz sessions with JSON configuration
- **Student/Player Mode**: Join sessions with session codes
- **Real-time Updates**: Live player tracking and synchronization
- **Multiple Question Types**: Single choice, multiple choice, and text input
- **Timed Questions**: Configurable time limits per question
- **Live Leaderboard**: Overall and section-based rankings
- **Responsive Design**: Works on desktop and mobile devices

## Setup Instructions

### Option 1: Firebase Integration (Recommended)
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Realtime Database
3. Replace the Firebase configuration in `script.js`:
   ```javascript
   const firebaseConfig = {
       apiKey: "your-api-key",
       authDomain: "your-project.firebaseapp.com",
       databaseURL: "https://your-project-default-rtdb.firebaseio.com",
       projectId: "your-project-id",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "123456789",
       appId: "your-app-id"
   };
   ```

### Option 2: Local Development (No Firebase)
The app will automatically fall back to localStorage for local testing. Real-time updates will be simulated with polling.

## Quiz JSON Format

Create your quiz using the following JSON structure:

```json
{
  "sections": [
    {
      "name": "HTML",
      "questions": [
        {
          "question": "What does HTML stand for?",
          "type": "single",
          "options": [
            "HyperText Markup Language",
            "Home Tool Markup Language",
            "Hyperlinks and Text Markup Language"
          ],
          "correct": 0,
          "timeLimit": 30
        },
        {
          "question": "Which HTML elements are used for lists?",
          "type": "multiple",
          "options": ["<ul>", "<ol>", "<li>", "<list>"],
          "correct": [0, 1, 2],
          "timeLimit": 45
        },
        {
          "question": "What is the correct DOCTYPE for HTML5?",
          "type": "text",
          "correct": "<!DOCTYPE html>",
          "timeLimit": 60
        }
      ]
    },
    {
      "name": "CSS",
      "questions": [
        {
          "question": "Which property is used to change text color?",
          "type": "single",
          "options": ["color", "text-color", "font-color"],
          "correct": 0,
          "timeLimit": 25
        }
      ]
    }
  ],
  "defaultTimeLimit": 60
}
```

### Question Types:
- **single**: Single choice (radio buttons)
  - `correct`: Index of correct option (number)
- **multiple**: Multiple choice (checkboxes)
  - `correct`: Array of correct option indices
- **text**: Text input
  - `correct`: Exact text answer (string)

## How to Use

### For Instructors (Admin):
1. Choose "I'm the Instructor (Admin)"
2. Paste your quiz JSON data
3. Click "Create Quiz Session"
4. Share the generated session code with students
5. Wait for students to join
6. Click "Start Quiz" when ready
7. Monitor progress and view final leaderboard

### For Students (Players):
1. Choose "I'm a Student (Player)"
2. Enter the session code provided by instructor
3. Enter your name
4. Wait in the waiting room
5. Answer questions when the quiz starts
6. View your results and ranking at the end

## File Structure

- `index.html` - Main application structure
- `styles.css` - All styling and responsive design
- `script.js` - Complete application logic and Firebase integration
- `README.md` - Documentation (this file)

## Browser Compatibility

- Modern browsers with ES6 support
- Chrome, Firefox, Safari, Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## Deployment

Simply upload all files to any web server. No build process required.

For Firebase integration, ensure your domain is added to the authorized domains in Firebase Console.

## Troubleshooting

### Firebase Issues:
- Check console for Firebase connection errors
- Verify Firebase configuration
- Ensure Realtime Database is enabled
- Check Firebase rules for read/write permissions

### Local Development:
- The app works offline using localStorage
- Real-time features are simulated with polling
- Perfect for testing quiz content

## Sample Sections

Common web training sections you might use:
- HTML (Structure, semantics, forms)
- CSS (Styling, layout, responsive design)  
- JavaScript (Syntax, DOM manipulation, events)
- Common (General web development concepts)
- Hosting (Deployment, domains, servers)
- Accessibility (WCAG guidelines, screen readers)
- Performance (Optimization, loading speed)
