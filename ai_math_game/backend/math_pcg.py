
import random
import json
from google import genai

class MathQuestionGenerator:
    def __init__(self, client=None):
        self.client = client
        self.model_id = "gemini-3-flash-preview"
        
        # ... (keep your existing class_operations and difficulty_params) ...
        self.class_1_2_operations = ['addition', 'subtraction', 'comparison']
        self.class_3_5_operations = ['addition', 'subtraction', 'multiplication', 'division', 'word_problems']
        self.difficulty_params = {
            'easy': {'addition': {'min': 1, 'max': 10}, 'subtraction': {'min': 1, 'max': 10}, 
                     'multiplication': {'min': 1, 'max': 5}, 'division': {'min': 1, 'max': 10}, 
                     'comparison': {'min': 1, 'max': 20}},
            'medium': {'addition': {'min': 10, 'max': 99}, 'subtraction': {'min': 10, 'max': 99}, 
                       'multiplication': {'min': 2, 'max': 10}, 'division': {'min': 2, 'max': 20}, 
                       'comparison': {'min': 20, 'max': 100}},
            'hard': {'addition': {'min': 50, 'max': 200}, 'subtraction': {'min': 50, 'max': 200}, 
                     'multiplication': {'min': 5, 'max': 15}, 'division': {'min': 5, 'max': 50}, 
                     'comparison': {'min': 100, 'max': 500}}
        }

    def generate_question(self, student_class, difficulty, operation=None, theme="space"):
        """Main entry point - now includes theme support."""
        if student_class in [1, 2]:
            available_operations = self.class_1_2_operations
        else:
            available_operations = self.class_3_5_operations
        
        if operation is None:
            operation = random.choice(available_operations)
        
        # Use AI for Word Problems, deterministic logic for the rest
        if operation == 'word_problems' and self.client:
            return self._generate_word_problem_ai(difficulty, theme, student_class)
        
        # Standard logic mapping
        operations_map = {
            'addition': self._generate_addition,
            'subtraction': self._generate_subtraction,
            'multiplication': self._generate_multiplication,
            'division': self._generate_division,
            'comparison': self._generate_comparison,
            'word_problems': self._generate_word_problem_legacy # Fallback if no client
        }
        
        func = operations_map.get(operation, self._generate_addition)
        return func(difficulty)

    def _generate_word_problem_ai(self, difficulty, theme, student_class):
        """Uses Gemini 3 for Context-Aware PCG."""
        try:
            prompt = (
                f"Generate a Class {student_class} math word problem. "
                f"Theme: {theme}. Difficulty: {difficulty}. "
                "Return ONLY a JSON object with keys: 'question', 'correct_answer' (int), 'wrong_answers' (list of 3 ints)."
            )
            
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=prompt
            )
            
            data = json.loads(response.text.replace('```json', '').replace('```', '').strip())
            
            return {
                'question': data['question'],
                'correct_answer': data['correct_answer'],
                'wrong_answers': data['wrong_answers'],
                'operation': 'word_problems',
                'difficulty': difficulty,
                'theme': theme
            }
        except Exception as e:
            print(f"AI PCG Failed: {e}")
            return self._generate_word_problem_legacy(difficulty)

    def _generate_word_problem_legacy(self, difficulty):
        """Template-based word problem generator (fallback when Gemini API is unavailable)."""
        names = ['Sarah', 'Tom', 'Ava', 'Liam', 'Mia', 'Noah', 'Emma', 'Jake', 'Zoe', 'Raj']
        items = ['apples', 'marbles', 'stickers', 'books', 'pencils', 'cookies', 'stars', 'balloons', 'coins', 'cards']

        name = random.choice(names)
        item = random.choice(items)
        params = self.difficulty_params[difficulty]

        # Pick a random operation type
        op_type = random.choice(['add', 'subtract', 'multiply'])

        if op_type == 'add':
            p = params['addition']
            a = random.randint(p['min'], p['max'])
            b = random.randint(p['min'], p['max'])
            correct = a + b
            templates = [
                f"{name} has {a} {item}. They get {b} more. How many {item} does {name} have now?",
                f"There are {a} {item} on a table. {name} adds {b} more. How many are there in total?",
                f"{name} collected {a} {item} in the morning and {b} in the evening. How many in all?",
            ]
        elif op_type == 'subtract':
            p = params['subtraction']
            a = random.randint(p['min'], p['max'])
            b = random.randint(p['min'], min(a, p['max']))
            correct = a - b
            templates = [
                f"{name} has {a} {item}. They give away {b}. How many {item} are left?",
                f"There were {a} {item}. {b} were eaten. How many remain?",
                f"{name} started with {a} {item} and lost {b}. How many does {name} have now?",
            ]
        else:  # multiply
            p = params['multiplication']
            a = random.randint(p['min'], p['max'])
            b = random.randint(p['min'], p['max'])
            correct = a * b
            templates = [
                f"{name} has {a} bags with {b} {item} each. How many {item} in total?",
                f"There are {a} rows of {item} with {b} in each row. How many {item} altogether?",
                f"{name} buys {a} packs of {item}. Each pack has {b}. How many {item} does {name} have?",
            ]

        question = random.choice(templates)
        wrong_answers = self._generate_wrong_answers(correct, difficulty)

        return {
            'question': question,
            'correct_answer': correct,
            'wrong_answers': wrong_answers,
            'operation': 'word_problems',
            'difficulty': difficulty
        }

    # ... (Keep your existing _generate_addition, _generate_wrong_answers, etc.) ...
    
    def _generate_addition(self, difficulty):
        """Generate addition question"""
        params = self.difficulty_params[difficulty]['addition']
        num1 = random.randint(params['min'], params['max'])
        num2 = random.randint(params['min'], params['max'])
        
        question = f"What is {num1} + {num2}?"
        correct_answer = num1 + num2
        
        # Generate wrong answers
        wrong_answers = self._generate_wrong_answers(correct_answer, difficulty)
        
        return {
            'question': question,
            'correct_answer': correct_answer,
            'wrong_answers': wrong_answers,
            'operation': 'addition',
            'difficulty': difficulty
        }
    
    def _generate_subtraction(self, difficulty):
        """Generate subtraction question"""
        params = self.difficulty_params[difficulty]['subtraction']
        num1 = random.randint(params['min'], params['max'])
        num2 = random.randint(params['min'], min(num1, params['max']))  # Ensure positive result
        
        question = f"What is {num1} - {num2}?"
        correct_answer = num1 - num2
        
        wrong_answers = self._generate_wrong_answers(correct_answer, difficulty)
        
        return {
            'question': question,
            'correct_answer': correct_answer,
            'wrong_answers': wrong_answers,
            'operation': 'subtraction',
            'difficulty': difficulty
        }
    
    def _generate_multiplication(self, difficulty):
        """Generate multiplication question"""
        params = self.difficulty_params[difficulty]['multiplication']
        num1 = random.randint(params['min'], params['max'])
        num2 = random.randint(params['min'], params['max'])
        
        question = f"What is {num1} × {num2}?"
        correct_answer = num1 * num2
        
        wrong_answers = self._generate_wrong_answers(correct_answer, difficulty)
        
        return {
            'question': question,
            'correct_answer': correct_answer,
            'wrong_answers': wrong_answers,
            'operation': 'multiplication',
            'difficulty': difficulty
        }
    
    def _generate_division(self, difficulty):
        """Generate division question with exact result"""
        params = self.difficulty_params[difficulty]['division']
        # Ensure divisor is at least 2 to avoid trivial division by 1
        min_divisor = max(2, params['min'])
        divisor = random.randint(min_divisor, params['max'])
        quotient = random.randint(params['min'], params['max'])
        dividend = divisor * quotient
        
        question = f"What is {dividend} ÷ {divisor}?"
        correct_answer = quotient
        
        wrong_answers = self._generate_wrong_answers(correct_answer, difficulty)
        
        return {
            'question': question,
            'correct_answer': correct_answer,
            'wrong_answers': wrong_answers,
            'operation': 'division',
            'difficulty': difficulty
        }
    
    def _generate_comparison(self, difficulty):
        """Generate number comparison question"""
        params = self.difficulty_params[difficulty]['comparison']
        num1 = random.randint(params['min'], params['max'])
        num2 = random.randint(params['min'], params['max'])
        
        operators = ['>', '<', '=']
        correct_operator = '=' if num1 == num2 else ('>' if num1 > num2 else '<')
        
        question = f"Which symbol is correct: {num1} ___ {num2}?"
        correct_answer = correct_operator
        
        wrong_answers = [op for op in operators if op != correct_operator]
        
        return {
            'question': question,
            'correct_answer': correct_answer,
            'wrong_answers': wrong_answers,
            'operation': 'comparison',
            'difficulty': difficulty
        }
    
    def _generate_word_problem(self, difficulty, theme="space", student_class=3):
        """Uses Gemini 3 to generate a theme-appropriate math word problem."""
        try:
            # Construct the pedagogical prompt
            gen_prompt = (
                f"Generate a math word problem for a Class {student_class} student. "
                f"Theme: {theme}. Difficulty: {difficulty}. "
                f"The problem should be solvable with a single operation. "
                f"Return a JSON object with: 'question', 'correct_answer' (number), "
                f"and 'wrong_answers' (list of 3 numbers)."
            )

            # Call the client you initialized in app.py
            # (Assuming you pass 'client' to the generator or use a global one)
            response = client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=gen_prompt
            )
            
            # Parse the JSON response
            import json
            data = json.loads(response.text.replace('```json', '').replace('```', '').strip())
            
            return {
                'question': data['question'],
                'correct_answer': data['correct_answer'],
                'wrong_answers': data['wrong_answers'],
                'operation': 'word_problems',
                'difficulty': difficulty,
                'theme': theme
            }
        except Exception as e:
            print(f"GenAI PCG Error: {e}")
            # Fallback to your old hardcoded logic if the API fails
            return self._old_generate_word_problem(difficulty)
        
    
    def _generate_wrong_answers(self, correct_answer, difficulty):
        """Generate plausible wrong answers"""
        wrong_answers = []
        
        if difficulty == 'easy':
            # Generate answers close to correct answer
            for i in range(3):
                offset = random.randint(1, 5)
                wrong = correct_answer + offset if random.choice([True, False]) else correct_answer - offset
                if wrong != correct_answer and wrong > 0:
                    wrong_answers.append(wrong)
        
        elif difficulty == 'medium':
            for i in range(3):
                offset = random.randint(5, 15)
                wrong = correct_answer + offset if random.choice([True, False]) else correct_answer - offset
                if wrong != correct_answer and wrong > 0:
                    wrong_answers.append(wrong)
        
        else:  # hard
            for i in range(3):
                offset = random.randint(10, 30)
                wrong = correct_answer + offset if random.choice([True, False]) else correct_answer - offset
                if wrong != correct_answer and wrong > 0:
                    wrong_answers.append(wrong)
        
        # Ensure we have exactly 3 unique wrong answers
        wrong_answers = list(set(wrong_answers))[:3]
        while len(wrong_answers) < 3:
            wrong = correct_answer + random.randint(1, 20)
            if wrong != correct_answer and wrong not in wrong_answers:
                wrong_answers.append(wrong)
        
        return wrong_answers[:3]
