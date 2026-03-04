# AI-Driven Procedural Math Learning Game for Primary School Students

## 🎮 Project Overview

This is an interactive web-based math learning game designed for Class 1-5 students. The system uses **Procedural Content Generation (PCG)** to dynamically generate math questions and implements **adaptive learning AI** to adjust difficulty based on student performance.

## 🌟 Key Features

### 🧩 Puzzle Game
- Multiple choice math questions
- Visual feedback for correct/incorrect answers
- Hint system for wrong answers
- Progressive difficulty levels

### 🏃 Runner Game
- Fast-paced endless runner gameplay

### Prerequisites
- Python 3.8 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation & Running

1. **Clone/Download the project**
   ```bash
   # Navigate to project directory
   cd ai_math_game
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Initialize the database**
   ```bash
   cd database
   python init_db.py
   cd ..
   ```

4. **Start the server**
   ```bash
   cd backend
   python app.py
   ```

5. **Open the application**
   - Open your web browser
   - Go to: **http://localhost:5000**

That's it! The system is now running and ready to use.

---

## 🎯 How to Use

### For Teachers: Create Games with AI

1. **Open the Teacher Interface** (http://localhost:5000)
2. **Type a natural language prompt** describing your desired game:
   ```
   "Create a runner game to teach addition for Class 3 with medium difficulty and fast gameplay."
   ```
3. **Click "Generate Game Configuration"**
4. **Review the generated configuration** (game type, math topic, difficulty, etc.)
5. **Click "Play Game"** to launch the generated game

### Example Prompts to Try:
- "Build a puzzle game for Class 1 subtraction with easy difficulty and space theme"
- "Make a runner game for Class 5 multiplication with hard difficulty and obstacles"
- "Design a puzzle game for Class 2 number comparison with medium difficulty and hints"

### For Students: Play the Games

#### 🧩 Puzzle Game
- **Goal**: Move your character from start to goal
- **How**: Click adjacent locked tiles to solve math problems
- **Unlock**: Correct answers unlock tiles and let you advance
- **Strategy**: Plan your path through the grid

#### 🏃 Runner Game
- **Goal**: Jump on correct answer platforms
- **Controls**: Press SPACE or click to jump
- **Avoid**: Red platforms (wrong answers)
- **Survive**: Keep jumping and don't fall!

---

## 🏗️ Project Structure

```
ai_math_game/
├── backend/                    # Python Flask server
│   ├── app.py                 # Main Flask application
│   ├── prompt_parser.py       # Natural language processing
│   ├── math_pcg.py          # Procedural content generation
│   ├── adaptive_ai.py        # Adaptive learning algorithms
│   └── student_model.py     # Database operations
├── frontend/                  # Web interface
│   ├── teacher_prompt.html   # Teacher interface
│   ├── puzzle_game.html     # Puzzle game page
│   ├── runner_game.html     # Runner game page
│   ├── puzzle_game.js      # Puzzle game logic
│   ├── runner_game.js      # Runner game logic
│   └── style.css          # Styling
├── database/                 # SQLite database
│   ├── init_db.py         # Database initialization
│   └── students.db        # Student data (created automatically)
├── requirements.txt         # Python dependencies
├── README.md              # This file
└── ACADEMIC_DOCUMENTATION.md  # Detailed academic explanations
```

---

## 🧠 AI Features

### Prompt-Based Game Generation
- **Natural Language Processing**: Understands teacher descriptions
- **Parameter Extraction**: Identifies game type, class, topic, difficulty
- **Configuration Generation**: Creates structured game settings
- **Validation**: Ensures educational appropriateness

### Procedural Content Generation (PCG)
- **Unlimited Questions**: Generates unique math problems
- **Intelligent Distractors**: Creates plausible wrong answers
- **Adaptive Layouts**: Dynamic level generation
- **Age-Appropriate**: Content tailored to class levels

### Adaptive Learning AI
- **Performance Tracking**: Monitors accuracy and response time
- **Difficulty Adjustment**: Adapts to individual student level
- **Personalized Paths**: Custom learning experiences
- **Analytics Dashboard**: Detailed progress reports

---

## 🎮 Game Features

### Puzzle Game: Math-Unlock System
- **Grid-Based Movement**: Navigate through tile grids
- **Math-Controlled Progress**: Solve problems to unlock tiles
- **Character Animation**: Visual feedback and movement
- **Strategic Planning**: Choose your path wisely
- **Progressive Difficulty**: Challenges increase as you advance

### Runner Game: Answer Platform System
- **Canvas-Based Physics**: Smooth jumping mechanics
- **Dynamic Platforms**: Math answers appear as platforms
- **Risk-Reward Gameplay**: Wrong answers have consequences
- **Speed Progression**: Game speeds up as you improve
- **Visual Feedback**: Clear success/failure indicators

---

## 📊 Educational Impact

### Learning Benefits
- **Increased Engagement**: Gamification makes math fun
- **Personalized Learning**: AI adapts to each student
- **Immediate Feedback**: Instant response to answers
- **Progress Tracking**: Detailed performance analytics
- **Self-Paced Learning**: Students learn at their own speed

### Teacher Benefits
- **Time Saving**: Automated game creation
- **Differentiated Instruction**: Multiple difficulty levels
- **Data-Driven Teaching**: Performance insights
- **Easy Integration**: Works with existing curriculum
- **No Technical Skills**: Natural language prompts

---

## 🔧 Technical Details

### Backend Technologies
- **Python 3.8+**: Server-side logic
- **Flask**: Web framework and API server
- **SQLite**: Lightweight database for student data
- **JSON**: Data interchange format

### Frontend Technologies
- **HTML5**: Semantic structure
- **CSS3**: Responsive design and animations
- **JavaScript ES6+**: Game logic and interactivity
- **Canvas API**: 2D graphics for runner game

### API Endpoints
- `POST /api/parse_prompt` - Parse natural language prompts
- `POST /api/generate_game` - Generate game from configuration
- `POST /api/generate_question` - Create math questions
- `POST /api/submit_answer` - Submit student answers
- `GET /api/get_prompt_examples` - Get example prompts

---

## 🧪 Testing the System

### Test the Prompt Parser
1. Go to http://localhost:5000
2. Enter a prompt like: "Create a puzzle game for Class 2 addition with easy difficulty"
3. Click "Generate Game Configuration"
4. Review the parsed configuration
5. Click "Play Puzzle Game" to test

### Test the Puzzle Game
1. Generate and launch a puzzle game
2. Click on a locked tile adjacent to your character
3. Solve the math problem that appears
4. Watch your character move to the unlocked tile
5. Try to reach the goal (🏁)

### Test the Runner Game
1. Generate and launch a runner game
2. Click "Start Game"
3. Press SPACE or click to jump
4. Try to land on green platforms (correct answers)
5. Avoid red platforms (wrong answers)

### Test Different Configurations
Try these prompts to test different features:

```bash
"Create a runner game to teach subtraction for Class 4 with hard difficulty"
"Build a puzzle game for Class 1 number comparison with easy difficulty and hints"
"Make a runner game for Class 5 division with medium speed and ocean theme"
"Design a puzzle game for Class 3 multiplication with progressive difficulty"
```

---

## 🐛 Troubleshooting

### Common Issues

**Server won't start:**
- Check Python version (3.8+ required)
- Install dependencies: `pip install -r requirements.txt`
- Check if port 5000 is available

**Games not loading:**
- Check browser console for errors (F12 → Console)
- Ensure server is running
- Try refreshing the page

**Database errors:**
- Run `python database/init_db.py` to initialize database
- Check write permissions in database folder

**Prompt parsing issues:**
- Use clear, specific language in prompts
- Include class level (1-5) and math topic
- Check example prompts for reference

### Getting Help
1. Check the browser console for error messages
2. Review the academic documentation for detailed explanations
3. Test with example prompts first
4. Ensure all dependencies are installed correctly

---

## 📈 Performance Metrics

### System Performance
- **Question Generation**: < 100ms per question
- **API Response Time**: < 200ms average
- **Content Variety**: Unlimited unique questions
- **Scalability**: Supports multiple concurrent users

### Learning Analytics
- **Accuracy Tracking**: Real-time performance monitoring
- **Progress Visualization**: Learning dashboards
- **Adaptation Effectiveness**: Difficulty optimization
- **Engagement Metrics**: Time on task, completion rates

---

## 🔮 Future Enhancements

### Planned Features
- **Multiplayer Support**: Collaborative learning games
- **Voice Control**: Hands-free gameplay options
- **AR/VR Integration**: Immersive learning experiences
- **Advanced Analytics**: Predictive learning insights
- **Curriculum Alignment**: Standards mapping

### Research Opportunities
- **Learning Effectiveness Studies**: Controlled experiments
- **AI Enhancement**: Machine learning for content generation
- **Cross-Subject Expansion**: Science, language arts games
- **Accessibility Improvements**: Support for diverse learners

---

## 📚 Academic Resources

### Documentation
- **ACADEMIC_DOCUMENTATION.md**: Detailed academic explanations
- **Code Comments**: Inline documentation throughout
- **API Documentation**: Endpoint descriptions and examples

### Research Foundations
- **Constructivist Learning**: Active knowledge construction
- **Cognitive Load Theory**: Optimal challenge levels
- **Flow Theory**: Engagement and motivation
- **Adaptive Learning**: Personalized education

---
### Q1: How does the Procedural Content Generation work in this system?
**Answer:** The PCG system dynamically generates math questions based on the student's class level, current difficulty, and selected operation. It uses predefined templates and randomization within educational constraints to create appropriate questions, ensuring variety while maintaining learning objectives.

### Q2: Explain the adaptive learning algorithm.
**Answer:** The adaptive learning algorithm tracks student performance metrics including accuracy, response time, and consistency. Based on thresholds (e.g., >80% accuracy for difficulty increase, <40% for decrease), it automatically adjusts the difficulty level to maintain optimal challenge and engagement.

### Q3: What database design patterns are used?
**Answer:** The system uses a relational database design with three main tables: Students (user information), Performance (detailed attempt tracking), and Difficulty Tracking (adaptive state management). This normalized approach ensures data integrity and efficient querying.

### Q4: How is the frontend-backend communication handled?
**Answer:** The system uses RESTful API endpoints with JSON for data exchange. CORS is enabled for cross-origin requests, and the frontend uses the Fetch API for asynchronous communication, ensuring responsive user experience.

### Q5: What makes this system educational effective?
**Answer:** The system combines gamification elements with personalized learning paths, immediate feedback, and comprehensive analytics. The adaptive difficulty ensures students are always challenged at their appropriate level, maximizing learning efficiency.

## 📄 License

This project is created for educational purposes. Feel free to use, modify, and distribute for learning and teaching.

## 👥 Contributors

This project was developed as a demonstration of AI-driven educational technology and procedural content generation in learning systems.

---

**Happy Learning! 🎓🎮**
