const { GoogleGenerativeAI } = require('@google/generative-ai');
const Room = require('../models/Room');

/**
 * Robust rule-based fallback summary generator if Gemini API is unavailable or unconfigured
 * @param {Array} messages - Chat messages list
 * @returns {Object} - Parsed summary and action items
 */
const generateFallbackSummary = (messages) => {
  if (!messages || messages.length === 0) {
    return {
      summary: 'This session ended without any chat activity. No discussions were captured in the chat logs.',
      actionItems: ['No explicit action items identified.'],
    };
  }

  const chatCount = messages.length;
  const uniqueSenders = [...new Set(messages.map((m) => m.username))];
  
  const summary = `During this session, ${chatCount} message(s) were exchanged among ${uniqueSenders.length} participant(s) (${uniqueSenders.join(', ')}). The conversation focused on the collaborative sharing of notes, files, and drawings in the room.`;

  const actionItems = [];
  messages.forEach((m) => {
    const text = m.content.toLowerCase();
    // Scan for action item keywords
    if (
      text.includes('todo') ||
      text.includes('need to') ||
      text.includes('will do') ||
      text.includes('action item') ||
      text.includes('please check') ||
      text.includes('fix') ||
      text.includes('should')
    ) {
      actionItems.push(`${m.username}: "${m.content}"`);
    }
  });

  if (actionItems.length === 0) {
    actionItems.push('No explicit action items were identified in the chat transcript.');
  }

  return { summary, actionItems };
};

/**
 * @desc    Generate meeting summary and action items using Google Gemini API
 * @route   POST /api/rooms/:roomId/summary
 * @access  Private
 */
const getRoomSummary = async (req, res) => {
  const { roomId } = req.params;
  const { messages } = req.body;

  try {
    let room;
    if (global.isMockDB) {
      global.mockRooms = global.mockRooms || [];
      room = global.mockRooms.find((r) => r.roomId === roomId.toLowerCase());
    } else {
      room = await Room.findOne({ roomId: roomId.toLowerCase() });
    }

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    let summaryData = null;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY' && messages && messages.length > 0) {
      try {
        console.log('Sending chat transcript to Google Gemini API for room:', roomId);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const transcriptText = messages
          .map((m) => `[${m.username}]: ${m.content}`)
          .join('\n');

        const prompt = `You are a professional meeting assistant AI. Analyze the following meeting chat log transcript and generate a professional, concise summary (1 cohesive paragraph) and a list of clear action items.
        
Transcript:
${transcriptText}

Provide the response in structured JSON format with EXACTLY two fields:
{
  "summary": "A cohesive summary paragraph of 3-5 sentences describing key discussion points and outcomes.",
  "actionItems": ["Action item 1", "Action item 2", ...]
}
Do not include any markdown formatting wrappers (such as \`\`\`json) outside of the valid JSON string. Return only raw JSON.`;

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        const responseText = result.response.text();
        console.log('Gemini API response received:', responseText);
        summaryData = JSON.parse(responseText.trim());
      } catch (geminiError) {
        console.error('Gemini API call failed, falling back to local engine:', geminiError.message);
        summaryData = generateFallbackSummary(messages);
      }
    } else {
      console.log('No Gemini API key or empty messages; using local summary generator.');
      summaryData = generateFallbackSummary(messages);
    }

    // Save summary results in MongoDB
    room.summary = summaryData.summary;
    room.actionItems = summaryData.actionItems;
    room.isActive = false; // Mark room as ended when finalized
    room.endedAt = new Date();
    
    if (!global.isMockDB) {
      await room.save();
    }

    return res.status(200).json({
      roomId: room.roomId,
      title: room.title,
      summary: room.summary,
      actionItems: room.actionItems,
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    return res.status(500).json({ message: error.message || 'Server error generating summary' });
  }
};

module.exports = {
  getRoomSummary,
};
