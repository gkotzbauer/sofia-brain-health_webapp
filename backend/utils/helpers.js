// Helper function to calculate About Me completeness
function calculateCompleteness(bestLifeElements, concerns, confidenceLevel) {
  let completeness = 0;
  if (bestLifeElements && bestLifeElements.length > 0) completeness += 40;
  if (concerns && concerns.length > 0) completeness += 40;
  if (confidenceLevel) completeness += 20;
  return completeness;
}

module.exports = { calculateCompleteness };
