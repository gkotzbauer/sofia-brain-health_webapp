/**
 * Value Alignment Manager
 * Ensures all conversations are focused on what matters most to each user
 * based on their About Me profile (concerns, goals, values)
 */

class ValueAlignmentManager {
    constructor() {
        this.userProfile = null;
        this.conversationContext = null;
        this.adherenceLog = [];
    }

    /**
     * Initialize with user profile data
     */
    initialize(userHistory) {
        this.userProfile = {
            bestLifeElements: userHistory.aboutMe?.bestLifeElements || [],
            concerns: userHistory.aboutMe?.concerns || [],
            confidenceLevel: userHistory.aboutMe?.confidenceLevel || 0,
            goals: userHistory.goals || [],
            values: userHistory.values || []
        };
        
        console.log('🎯 Value Alignment Manager initialized:', this.userProfile);
    }

    /**
     * Check if a response aligns with user's values and concerns
     */
    checkValueAlignment(userInput, aiResponse, conversationPhase) {
        const alignment = {
            timestamp: new Date().toISOString(),
            userInput: userInput,
            aiResponse: aiResponse,
            conversationPhase: conversationPhase,
            alignmentScore: 0,
            valueMatches: [],
            concernMatches: [],
            misalignments: [],
            recommendations: []
        };

        // Check alignment with best life elements
        if (this.userProfile.bestLifeElements.length > 0) {
            this.userProfile.bestLifeElements.forEach(element => {
                if (aiResponse.toLowerCase().includes(element.element.toLowerCase()) ||
                    aiResponse.toLowerCase().includes(element.description?.toLowerCase())) {
                    alignment.valueMatches.push({
                        type: 'best_life_element',
                        element: element.element,
                        description: element.description
                    });
                    alignment.alignmentScore += 2;
                }
            });
        }

        // Check alignment with concerns
        if (this.userProfile.concerns.length > 0) {
            this.userProfile.concerns.forEach(concern => {
                if (aiResponse.toLowerCase().includes(concern.concern.toLowerCase()) ||
                    aiResponse.toLowerCase().includes(concern.description?.toLowerCase())) {
                    alignment.concernMatches.push({
                        type: 'concern',
                        concern: concern.concern,
                        description: concern.description
                    });
                    alignment.alignmentScore += 2;
                }
            });
        }

        // Check alignment with active goals
        const activeGoals = this.userProfile.goals.filter(g => g.status === 'active');
        if (activeGoals.length > 0) {
            activeGoals.forEach(goal => {
                if (aiResponse.toLowerCase().includes(goal.goal.toLowerCase())) {
                    alignment.valueMatches.push({
                        type: 'active_goal',
                        goal: goal.goal,
                        description: goal.description
                    });
                    alignment.alignmentScore += 1;
                }
            });
        }

        // Identify potential misalignments
        if (alignment.alignmentScore === 0) {
            alignment.misalignments.push({
                type: 'no_value_alignment',
                description: 'Response does not reference user values, concerns, or goals'
            });
        }

        // Generate recommendations for better alignment
        if (alignment.alignmentScore < 3) {
            alignment.recommendations = this.generateAlignmentRecommendations();
        }

        // Log the alignment check
        this.logAlignmentCheck(alignment);

        return alignment;
    }

    /**
     * Generate recommendations for better value alignment
     */
    generateAlignmentRecommendations() {
        const recommendations = [];

        // Suggest referencing best life elements
        if (this.userProfile.bestLifeElements.length > 0) {
            const randomElement = this.userProfile.bestLifeElements[
                Math.floor(Math.random() * this.userProfile.bestLifeElements.length)
            ];
            recommendations.push({
                type: 'reference_best_life',
                suggestion: `Reference the user's value: "${randomElement.element}"`,
                element: randomElement
            });
        }

        // Suggest addressing concerns
        if (this.userProfile.concerns.length > 0) {
            const randomConcern = this.userProfile.concerns[
                Math.floor(Math.random() * this.userProfile.concerns.length)
            ];
            recommendations.push({
                type: 'address_concern',
                suggestion: `Address the user's concern: "${randomConcern.concern}"`,
                concern: randomConcern
            });
        }

        // Suggest goal alignment
        const activeGoals = this.userProfile.goals.filter(g => g.status === 'active');
        if (activeGoals.length > 0) {
            const randomGoal = activeGoals[
                Math.floor(Math.random() * activeGoals.length)
            ];
            recommendations.push({
                type: 'align_with_goal',
                suggestion: `Connect to the user's goal: "${randomGoal.goal}"`,
                goal: randomGoal
            });
        }

        return recommendations;
    }

    /**
     * Log alignment check for monitoring and improvement
     */
    logAlignmentCheck(alignment) {
        this.adherenceLog.push(alignment);
        
        // Keep only last 100 entries to prevent memory issues
        if (this.adherenceLog.length > 100) {
            this.adherenceLog = this.adherenceLog.slice(-100);
        }

        // Log to console for debugging
        console.log('🎯 Value Alignment Check:', {
            score: alignment.alignmentScore,
            matches: alignment.valueMatches.length + alignment.concernMatches.length,
            misalignments: alignment.misalignments.length,
            recommendations: alignment.recommendations.length
        });

        // Store in userHistory for persistence
        if (typeof userHistory !== 'undefined') {
            if (!userHistory.valueAlignmentLog) {
                userHistory.valueAlignmentLog = [];
            }
            userHistory.valueAlignmentLog.push(alignment);
            saveUserHistory();
        }
    }

    /**
     * Get alignment statistics
     */
    getAlignmentStats() {
        if (this.adherenceLog.length === 0) {
            return {
                totalChecks: 0,
                averageScore: 0,
                alignmentRate: 0,
                topRecommendations: []
            };
        }

        const totalChecks = this.adherenceLog.length;
        const averageScore = this.adherenceLog.reduce((sum, check) => sum + check.alignmentScore, 0) / totalChecks;
        const alignmentRate = this.adherenceLog.filter(check => check.alignmentScore >= 3).length / totalChecks;

        // Get top recommendations
        const allRecommendations = this.adherenceLog.flatMap(check => check.recommendations);
        const recommendationCounts = {};
        allRecommendations.forEach(rec => {
            const key = `${rec.type}:${rec.suggestion}`;
            recommendationCounts[key] = (recommendationCounts[key] || 0) + 1;
        });

        const topRecommendations = Object.entries(recommendationCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([key, count]) => ({
                recommendation: key.split(':')[1],
                count: count
            }));

        return {
            totalChecks,
            averageScore: Math.round(averageScore * 100) / 100,
            alignmentRate: Math.round(alignmentRate * 100),
            topRecommendations
        };
    }

    /**
     * Enhance AI response with value alignment
     */
    enhanceResponseWithValues(aiResponse, userInput) {
        let enhancedResponse = aiResponse;

        // If response doesn't have good alignment, enhance it
        const alignment = this.checkValueAlignment(userInput, aiResponse, 'response_generation');
        
        if (alignment.alignmentScore < 3 && alignment.recommendations.length > 0) {
            const topRecommendation = alignment.recommendations[0];
            
            // Add value-based context to the response
            if (topRecommendation.type === 'reference_best_life') {
                enhancedResponse += `\n\nI want to make sure this aligns with what matters most to you. I know that ${topRecommendation.element.element.toLowerCase()} is important in your life. How does this relate to that?`;
            } else if (topRecommendation.type === 'address_concern') {
                enhancedResponse += `\n\nI also want to address your concern about ${topRecommendation.concern.concern.toLowerCase()}. How does this information help with that?`;
            } else if (topRecommendation.type === 'align_with_goal') {
                enhancedResponse += `\n\nThis connects to your goal of ${topRecommendation.goal.goal.toLowerCase()}. How does this help you move toward that?`;
            }
        }

        return enhancedResponse;
    }

    /**
     * Get conversation context that should drive responses
     */
    getConversationContext() {
        return {
            userValues: this.userProfile.bestLifeElements.map(e => e.element),
            userConcerns: this.userProfile.concerns.map(c => c.concern),
            activeGoals: this.userProfile.goals.filter(g => g.status === 'active').map(g => g.goal),
            confidenceLevel: this.userProfile.confidenceLevel
        };
    }

    /**
     * Check if a topic change aligns with user values
     */
    validateTopicChange(newTopic, currentContext) {
        const topicAlignment = {
            topic: newTopic,
            isValueAligned: false,
            reasoning: '',
            suggestedApproach: ''
        };

        // Check if new topic relates to user values
        const topicLower = newTopic.toLowerCase();
        
        // Check against best life elements
        const valueMatch = this.userProfile.bestLifeElements.find(element => 
            topicLower.includes(element.element.toLowerCase()) ||
            element.element.toLowerCase().includes(topicLower)
        );

        if (valueMatch) {
            topicAlignment.isValueAligned = true;
            topicAlignment.reasoning = `Topic aligns with your value: ${valueMatch.element}`;
            topicAlignment.suggestedApproach = 'Proceed with topic exploration';
        } else {
            // Check if it's a concern-related topic
            const concernMatch = this.userProfile.concerns.find(concern => 
                topicLower.includes(concern.concern.toLowerCase()) ||
                concern.concern.toLowerCase().includes(topicLower)
            );

            if (concernMatch) {
                topicAlignment.isValueAligned = true;
                topicAlignment.reasoning = `Topic addresses your concern: ${concernMatch.concern}`;
                topicAlignment.suggestedApproach = 'Address concern while maintaining value focus';
            } else {
                topicAlignment.reasoning = 'Topic may not directly align with current values/concerns';
                topicAlignment.suggestedApproach = 'Consider if this serves the user\'s stated priorities';
            }
        }

        return topicAlignment;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValueAlignmentManager;
} else {
    // Browser environment
    window.ValueAlignmentManager = ValueAlignmentManager;
}
