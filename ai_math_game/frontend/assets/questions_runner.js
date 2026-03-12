const questions = [
    // Trig Identities - Easy
    { q: "sin²θ + cos²θ = ____", a: "1", topic: "identities", difficulty: "easy" },
    { q: "1 + tan²θ = ____", a: "sec²θ", topic: "identities", difficulty: "medium" },
    { q: "1 + cot²θ = ____", a: "csc²θ", topic: "identities", difficulty: "medium" },
    { q: "cos²θ = 1 - ____", a: "sin²θ", topic: "identities", difficulty: "easy" },
    { q: "sin²θ = 1 - ____", a: "cos²θ", topic: "identities", difficulty: "easy" },
    { q: "tanθ = sinθ / ____", a: "cosθ", topic: "identities", difficulty: "easy" },
    { q: "cotθ = cosθ / ____", a: "sinθ", topic: "identities", difficulty: "easy" },
    { q: "secθ = 1 / ____", a: "cosθ", topic: "identities", difficulty: "easy" },
    { q: "cscθ = 1 / ____", a: "sinθ", topic: "identities", difficulty: "easy" },

    // Standard Trig Values - Easy
    { q: "sin(30°) = ____", a: "1/2", topic: "values", difficulty: "easy" },
    { q: "cos(60°) = ____", a: "1/2", topic: "values", difficulty: "easy" },
    { q: "tan(45°) = ____", a: "1", topic: "values", difficulty: "easy" },
    { q: "sin(90°) = ____", a: "1", topic: "values", difficulty: "easy" },
    { q: "cos(0°) = ____", a: "1", topic: "values", difficulty: "easy" },
    { q: "tan(0°) = ____", a: "0", topic: "values", difficulty: "easy" },
    { q: "sin(0°) = ____", a: "0", topic: "values", difficulty: "easy" },
    { q: "cos(90°) = ____", a: "0", topic: "values", difficulty: "easy" },
    { q: "cos(45°) = ____", a: "√2/2", topic: "values", difficulty: "medium" },
    { q: "sin(45°) = ____", a: "√2/2", topic: "values", difficulty: "medium" },
    { q: "sin(60°) = ____", a: "√3/2", topic: "values", difficulty: "medium" },
    { q: "cos(30°) = ____", a: "√3/2", topic: "values", difficulty: "medium" },
    { q: "tan(30°) = ____", a: "√3/3", topic: "values", difficulty: "medium" },
    { q: "tan(60°) = ____", a: "√3", topic: "values", difficulty: "medium" },

    // Trig Ratios - Easy
    { q: "sinθ = ____ / hypotenuse", a: "opposite", topic: "ratios", difficulty: "easy" },
    { q: "cosθ = ____ / hypotenuse", a: "adjacent", topic: "ratios", difficulty: "easy" },
    { q: "tanθ = ____ / adjacent", a: "opposite", topic: "ratios", difficulty: "easy" },
    { q: "SOH stands for: ____ = Opposite/Hypotenuse", a: "sin", topic: "ratios", difficulty: "easy" },
    { q: "CAH stands for: ____ = Adjacent/Hypotenuse", a: "cos", topic: "ratios", difficulty: "easy" },
    { q: "TOA stands for: ____ = Opposite/Adjacent", a: "tan", topic: "ratios", difficulty: "easy" },

    // Angle Relationships - Medium
    { q: "sin(180° - θ) = ____", a: "sinθ", topic: "angles", difficulty: "medium" },
    { q: "cos(180° - θ) = ____", a: "-cosθ", topic: "angles", difficulty: "medium" },
    { q: "sin(-θ) = ____", a: "-sinθ", topic: "angles", difficulty: "medium" },
    { q: "cos(-θ) = ____", a: "cosθ", topic: "angles", difficulty: "medium" },
    { q: "tan(-θ) = ____", a: "-tanθ", topic: "angles", difficulty: "medium" },
    { q: "sin(90° - θ) = ____", a: "cosθ", topic: "angles", difficulty: "medium" },
    { q: "cos(90° - θ) = ____", a: "sinθ", topic: "angles", difficulty: "medium" },
    { q: "tan(90° - θ) = ____", a: "cotθ", topic: "angles", difficulty: "hard" },

    // Unit Circle - Medium
    { q: "At 0°, coordinates are (____, 0)", a: "1", topic: "unitcircle", difficulty: "easy" },
    { q: "At 90°, coordinates are (0, ____)", a: "1", topic: "unitcircle", difficulty: "easy" },
    { q: "At 180°, coordinates are (____, 0)", a: "-1", topic: "unitcircle", difficulty: "easy" },
    { q: "At 270°, coordinates are (0, ____)", a: "-1", topic: "unitcircle", difficulty: "easy" },
    { q: "At 45°, coordinates are (____, ____)", a: "√2/2, √2/2", topic: "unitcircle", difficulty: "medium" },
    { q: "At 30°, x-coordinate is ____", a: "√3/2", topic: "unitcircle", difficulty: "medium" },
    { q: "At 60°, y-coordinate is ____", a: "√3/2", topic: "unitcircle", difficulty: "medium" },

    // Advanced Identities - Hard
    { q: "sin(2θ) = 2sinθ·____", a: "cosθ", topic: "identities", difficulty: "hard" },
    { q: "cos(2θ) = cos²θ - ____", a: "sin²θ", topic: "identities", difficulty: "hard" },
    { q: "cos(2θ) = 2cos²θ - ____", a: "1", topic: "identities", difficulty: "hard" },
    { q: "cos(2θ) = 1 - 2____", a: "sin²θ", topic: "identities", difficulty: "hard" },
    { q: "tan(2θ) = 2tanθ / (1 - ____)", a: "tan²θ", topic: "identities", difficulty: "hard" },
    { q: "sin(A+B) = sinA·cosB + cosA·____", a: "sinB", topic: "identities", difficulty: "hard" },
    { q: "cos(A+B) = cosA·cosB - sinA·____", a: "sinB", topic: "identities", difficulty: "hard" },
    { q: "sin(A-B) = sinA·cosB - cosA·____", a: "sinB", topic: "identities", difficulty: "hard" },
    { q: "cos(A-B) = cosA·cosB + sinA·____", a: "sinB", topic: "identities", difficulty: "hard" },

    // More Standard Values - Medium
    { q: "sin(120°) = ____", a: "√3/2", topic: "values", difficulty: "medium" },
    { q: "cos(120°) = ____", a: "-1/2", topic: "values", difficulty: "medium" },
    { q: "sin(150°) = ____", a: "1/2", topic: "values", difficulty: "medium" },
    { q: "cos(150°) = ____", a: "-√3/2", topic: "values", difficulty: "medium" },
    { q: "sin(135°) = ____", a: "√2/2", topic: "values", difficulty: "medium" },
    { q: "cos(135°) = ____", a: "-√2/2", topic: "values", difficulty: "medium" },
    { q: "tan(135°) = ____", a: "-1", topic: "values", difficulty: "medium" },
    { q: "tan(150°) = ____", a: "-√3/3", topic: "values", difficulty: "medium" },

    // Radian Values - Hard
    { q: "sin(π/6) = ____", a: "1/2", topic: "radians", difficulty: "medium" },
    { q: "cos(π/3) = ____", a: "1/2", topic: "radians", difficulty: "medium" },
    { q: "sin(π/2) = ____", a: "1", topic: "radians", difficulty: "easy" },
    { q: "cos(π) = ____", a: "-1", topic: "radians", difficulty: "easy" },
    { q: "sin(π/4) = ____", a: "√2/2", topic: "radians", difficulty: "medium" },
    { q: "cos(π/4) = ____", a: "√2/2", topic: "radians", difficulty: "medium" },
    { q: "tan(π/6) = ____", a: "√3/3", topic: "radians", difficulty: "medium" },
    { q: "tan(π/3) = ____", a: "√3", topic: "radians", difficulty: "medium" },

    // Pythagorean Identities - Medium
    { q: "sin²θ = (1 - cos(2θ))/____", a: "2", topic: "identities", difficulty: "hard" },
    { q: "cos²θ = (1 + cos(2θ))/____", a: "2", topic: "identities", difficulty: "hard" },
    { q: "1 - cos²θ = ____", a: "sin²θ", topic: "identities", difficulty: "easy" },
    { q: "sec²θ - tan²θ = ____", a: "1", topic: "identities", difficulty: "medium" },
    { q: "csc²θ - cot²θ = ____", a: "1", topic: "identities", difficulty: "medium" },

    // Reciprocal Identities - Easy
    { q: "sinθ = 1/____", a: "cscθ", topic: "identities", difficulty: "easy" },
    { q: "cosθ = 1/____", a: "secθ", topic: "identities", difficulty: "easy" },
    { q: "tanθ = 1/____", a: "cotθ", topic: "identities", difficulty: "easy" },
    { q: "cotθ = 1/____", a: "tanθ", topic: "identities", difficulty: "easy" },
    { q: "secθ = 1/____", a: "cosθ", topic: "identities", difficulty: "easy" },
    { q: "cscθ = 1/____", a: "sinθ", topic: "identities", difficulty: "easy" },

    // Even/Odd Properties - Medium
    { q: "cos is an ____ function", a: "even", topic: "properties", difficulty: "medium" },
    { q: "sin is an ____ function", a: "odd", topic: "properties", difficulty: "medium" },
    { q: "tan is an ____ function", a: "odd", topic: "properties", difficulty: "medium" },
    { q: "cos(-θ) = ____", a: "cosθ", topic: "properties", difficulty: "easy" },
    { q: "sin(-θ) = ____", a: "-sinθ", topic: "properties", difficulty: "easy" },

    // Period Properties - Medium
    { q: "sin has period ____", a: "2π", topic: "properties", difficulty: "medium" },
    { q: "cos has period ____", a: "2π", topic: "properties", difficulty: "medium" },
    { q: "tan has period ____", a: "π", topic: "properties", difficulty: "medium" },
    { q: "sin(θ + 2π) = ____", a: "sinθ", topic: "properties", difficulty: "medium" },
    { q: "cos(θ + 2π) = ____", a: "cosθ", topic: "properties", difficulty: "medium" },
    { q: "tan(θ + π) = ____", a: "tanθ", topic: "properties", difficulty: "medium" },

    // Complementary Angles - Medium
    { q: "sin(π/2 - θ) = ____", a: "cosθ", topic: "angles", difficulty: "medium" },
    { q: "cos(π/2 - θ) = ____", a: "sinθ", topic: "angles", difficulty: "medium" },
    { q: "tan(π/2 - θ) = ____", a: "cotθ", topic: "angles", difficulty: "hard" },
    { q: "cot(π/2 - θ) = ____", a: "tanθ", topic: "angles", difficulty: "hard" },
    { q: "sec(π/2 - θ) = ____", a: "cscθ", topic: "angles", difficulty: "hard" },
    { q: "csc(π/2 - θ) = ____", a: "secθ", topic: "angles", difficulty: "hard" },

    // Additional Values - Hard
    { q: "sin(15°) = (√6 - √2)/____", a: "4", topic: "values", difficulty: "hard" },
    { q: "cos(15°) = (√6 + √2)/____", a: "4", topic: "values", difficulty: "hard" },
    { q: "sin(75°) = (√6 + √2)/____", a: "4", topic: "values", difficulty: "hard" },
    { q: "cos(75°) = (√6 - √2)/____", a: "4", topic: "values", difficulty: "hard" },

    // Sum to Product - Hard
    { q: "sinA + sinB = 2sin((A+B)/2)·____", a: "cos((A-B)/2)", topic: "identities", difficulty: "hard" },
    { q: "cosA + cosB = 2cos((A+B)/2)·____", a: "cos((A-B)/2)", topic: "identities", difficulty: "hard" },
    { q: "sinA - sinB = 2cos((A+B)/2)·____", a: "sin((A-B)/2)", topic: "identities", difficulty: "hard" },
    { q: "cosA - cosB = -2sin((A+B)/2)·____", a: "sin((A-B)/2)", topic: "identities", difficulty: "hard" }
];

// Multiple choice options generator
function generateMultipleChoices(correctAnswer, topic) {
    console.log('generateMultipleChoices called with:', correctAnswer, topic);
    const choices = [correctAnswer];

    // Generate distractors based on topic
    if (topic === "values") {
        const commonValues = ["0", "1/2", "√2/2", "√3/2", "1", "√3/3", "√3", "-1/2", "-√2/2", "-√3/2", "-1", "-√3/3", "-√3"];
        const distractors = commonValues.filter(val => val !== correctAnswer);
        choices.push(...distractors.slice(0, 3));
    } else if (topic === "identities") {
        const commonIdentities = ["sinθ", "cosθ", "tanθ", "cotθ", "secθ", "cscθ", "sin²θ", "cos²θ", "tan²θ", "1", "2", "0"];
        const distractors = commonIdentities.filter(val => val !== correctAnswer);
        choices.push(...distractors.slice(0, 3));
    } else if (topic === "ratios") {
        const commonRatios = ["opposite", "adjacent", "hypotenuse", "sin", "cos", "tan"];
        const distractors = commonRatios.filter(val => val !== correctAnswer);
        choices.push(...distractors.slice(0, 3));
    } else {
        // Generic distractors
        const generic = ["0", "1", "sinθ", "cosθ", "tanθ", correctAnswer + "θ"];
        const distractors = generic.filter(val => val !== correctAnswer);
        choices.push(...distractors.slice(0, 3));
    }

    // Shuffle and return 4 choices
    const result = choices.sort(() => Math.random() - 0.5).slice(0, 4);
    console.log('Final choices array:', result);
    return result;
}

// Make function globally available
window.generateMultipleChoices = generateMultipleChoices;