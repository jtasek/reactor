/** What a request sends to the AI provider and what Reactor keeps of it, as the product tells people. */
export const AI_DISCLOSURE = {
    sent: 'Each request sends your words and the selected part of the document, or the whole document when nothing is selected, to the AI provider this server uses, which handles them under its own terms.',
    local: 'This chat answers from the local test model: scripted proposals made in this browser, with no AI and no server. Nothing is sent anywhere. Send /help to see what it understands.',
    kept: 'Reactor keeps who asked, when, in which document, the model and the tokens used, for daily limits. It does not store your words, what was sent or the answer, which reaches the document only if you accept it; a request is held in memory for 5 minutes so one problem with its answer can be sent back.'
};
