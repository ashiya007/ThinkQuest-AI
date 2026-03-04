import json
import os

class PromptParser:
    """
    The Orchestrator's brain - converts natural language teacher prompts
    into comprehensive game configuration schemas.
    """
    
    def __init__(self, client):
        self.client = client
        
        # Theme-to-visual-assets mapping
        self.theme_assets = {
            "space": {
                "primary_color": "#1a1a2e",
                "secondary_color": "#16213e", 
                "accent_color": "#0f3460",
                "highlight_color": "#e94560",
                "background_gradient": "linear-gradient(135deg, #0c0c1e 0%, #1a1a3e 100%)",
                "character_emoji": "🚀",
                "goal_emoji": "🌟",
                "obstacle_emoji": "☄️",
                "correct_emoji": "✨",
                "wrong_emoji": "💥"
            },
            "ocean": {
                "primary_color": "#006994",
                "secondary_color": "#40E0D0",
                "accent_color": "#48D1CC",
                "highlight_color": "#FFD700",
                "background_gradient": "linear-gradient(135deg, #006994 0%, #40E0D0 100%)",
                "character_emoji": "🐠",
                "goal_emoji": "🏝️",
                "obstacle_emoji": "🦈",
                "correct_emoji": "🐚",
                "wrong_emoji": "🌊"
            },
            "jungle": {
                "primary_color": "#228B22",
                "secondary_color": "#32CD32",
                "accent_color": "#8B4513",
                "highlight_color": "#FFD700",
                "background_gradient": "linear-gradient(135deg, #1a4314 0%, #2d5a27 100%)",
                "character_emoji": "🐒",
                "goal_emoji": "🏆",
                "obstacle_emoji": "🐍",
                "correct_emoji": "🍌",
                "wrong_emoji": "🌿"
            },
            "fantasy": {
                "primary_color": "#4B0082",
                "secondary_color": "#8A2BE2",
                "accent_color": "#9400D3",
                "highlight_color": "#FFD700",
                "background_gradient": "linear-gradient(135deg, #2d1b4e 0%, #4a2c6d 100%)",
                "character_emoji": "🧙",
                "goal_emoji": "👑",
                "obstacle_emoji": "🐉",
                "correct_emoji": "⭐",
                "wrong_emoji": "💀"
            },
            "candy": {
                "primary_color": "#FF69B4",
                "secondary_color": "#FFB6C1",
                "accent_color": "#FF1493",
                "highlight_color": "#00CED1",
                "background_gradient": "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
                "character_emoji": "🍬",
                "goal_emoji": "🎂",
                "obstacle_emoji": "🍫",
                "correct_emoji": "🍭",
                "wrong_emoji": "🍩"
            },
            "default": {
                "primary_color": "#667eea",
                "secondary_color": "#764ba2",
                "accent_color": "#5a67d8",
                "highlight_color": "#48bb78",
                "background_gradient": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "character_emoji": "🤖",
                "goal_emoji": "🏁",
                "obstacle_emoji": "🔒",
                "correct_emoji": "✅",
                "wrong_emoji": "❌"
            }
        }
        
        # Speed baseline configurations
        self.speed_configs = {
            "slow": {
                "platform_speed": 2,
                "question_time_limit": 30,
                "animation_duration": 1000,
                "spawn_interval": 3000
            },
            "normal": {
                "platform_speed": 4,
                "question_time_limit": 20,
                "animation_duration": 600,
                "spawn_interval": 2000
            },
            "fast": {
                "platform_speed": 6,
                "question_time_limit": 10,
                "animation_duration": 300,
                "spawn_interval": 1200
            }
        }

    def parse_prompt(self, prompt: str) -> dict:
        """
        Uses Gemini to semantically understand teacher intent and generate
        a comprehensive game orchestration schema.
        """
        
        system_instruction = """
You are an Educational Game Orchestrator AI. Convert the teacher's natural language request into a comprehensive JSON game configuration schema.

IMPORTANT: Output ONLY valid JSON, no explanations or markdown.

Required JSON structure:
{
    "game_type": "runner" | "puzzle" | "shooter" | "quiz" | "kangaroo",
    "class_level": 1-5 (integer),
    "operations": ["addition", "subtraction", "multiplication", "division", "comparison", "word_problems"],
    "difficulty": "easy" | "medium" | "hard",
    "speed_baseline": "slow" | "normal" | "fast",
    "theme": "space" | "ocean" | "jungle" | "fantasy" | "candy" | "default",
    "session_config": {
        "questions_per_round": 5-20 (integer),
        "enable_hints": true | false,
        "enable_timer": true | false,
        "adaptive_difficulty": true | false
    }
}

Rules:
1. Extract game_type from keywords like "runner", "puzzle", "quiz", "shooter", "blaster", "kangaroo", "hop", "jump"
2. Map grade/class mentions: "3rd grade", "Class 3", "10 year olds" → class_level: 3
3. operations: Array of math topics. Can include multiple if teacher wants mixed practice.
4. speed_baseline: Infer from "fast-paced", "challenging", "relaxed", "beginner-friendly"
5. theme: Match to closest available theme or use "default"
6. session_config: Infer from context (hints for younger students, timers for challenge modes)
"""

        try:
            response = self.client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=f"{system_instruction}\n\nTeacher Request: {prompt}"
            )
            
            raw_text = response.text.strip()
            
            # Clean markdown formatting
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0]
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0]
            
            config = json.loads(raw_text.strip())
            
            # Enrich with visual assets and speed config
            config = self._enrich_config(config, prompt)
            
            return config 

        except Exception as e:
            print(f"AI Parsing Error: {e}")
            return self._get_default_config(prompt)
    
    def _enrich_config(self, config: dict, original_prompt: str) -> dict:
        """Enriches the AI-generated config with visual assets and speed settings."""
        
        # Ensure required fields exist
        config.setdefault('game_type', 'puzzle')
        config.setdefault('class_level', 3)
        config.setdefault('difficulty', 'medium')
        config.setdefault('speed_baseline', 'normal')
        config.setdefault('theme', 'default')
        config.setdefault('session_config', {
            'questions_per_round': 10,
            'enable_hints': True,
            'enable_timer': True,
            'adaptive_difficulty': True
        })
        
        # Normalize operations to array
        if 'operations' not in config:
            if 'math_topic' in config:
                config['operations'] = [config['math_topic']]
            else:
                config['operations'] = ['addition']
        elif isinstance(config.get('operations'), str):
            config['operations'] = [config['operations']]
        
        # Get theme assets
        theme_key = config['theme'].lower() if config['theme'] else 'default'
        if theme_key not in self.theme_assets:
            theme_key = 'default'
        config['visual_assets'] = self.theme_assets[theme_key]
        
        # Get speed configuration
        speed_key = config['speed_baseline'].lower() if config['speed_baseline'] else 'normal'
        if speed_key not in self.speed_configs:
            speed_key = 'normal'
        config['speed_config'] = self.speed_configs[speed_key]
        
        # Store original prompt
        config['prompt'] = original_prompt
        
        # Generate session ID placeholder (actual ID created when launched)
        config['schema_version'] = '2.0'
        
        return config
    
    def _get_default_config(self, prompt: str) -> dict:
        """Returns a safe default configuration when AI parsing fails."""
        # Simple keyword fallback since AI is rate limited occasionally
        game_type = "puzzle"
        prompt_lower = prompt.lower()
        if "kangaroo" in prompt_lower or "hop" in prompt_lower or "jump" in prompt_lower:
            game_type = "kangaroo"
        elif "runner" in prompt_lower:
            game_type = "runner"
        elif "shooter" in prompt_lower or "blaster" in prompt_lower or "alien" in prompt_lower:
            game_type = "shooter"
        elif "quiz" in prompt_lower:
            game_type = "quiz"
            
        return self._enrich_config({
            "game_type": game_type,
            "class_level": 3,
            "operations": ["addition"],
            "difficulty": "medium",
            "speed_baseline": "normal",
            "theme": "default",
            "session_config": {
                "questions_per_round": 10,
                "enable_hints": True,
                "enable_timer": True,
                "adaptive_difficulty": True
            }
        }, prompt)

    def get_prompt_examples(self):
        """Returns orchestrator-style example prompts for teachers."""
        return [
            "3rd Grade Division in a Space theme with fast gameplay and no hints",
            "Create a relaxed ocean-themed puzzle for 1st graders learning addition and subtraction",
            "Fast-paced runner game for 5th grade multiplication and division practice with adaptive difficulty",
            "Fantasy quiz for Class 4 covering all operations with 15 questions per round",
            "Beginner-friendly candy-themed game for 2nd graders comparing numbers",
            "Create a fast-paced kangaroo game for 3rd grade addition and subtraction"
        ]
    
    def get_available_themes(self):
        """Returns available themes for the dashboard UI."""
        return list(self.theme_assets.keys())
    
    def get_theme_preview(self, theme: str) -> dict:
        """Returns visual assets for a specific theme."""
        return self.theme_assets.get(theme.lower(), self.theme_assets['default'])