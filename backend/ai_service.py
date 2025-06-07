import os
from openai import OpenAI
from typing import List, Dict, Optional
import json
import logging

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.api_key = os.environ.get('OPENAI_API_KEY')
        self.model = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
        self.max_tokens = int(os.environ.get('OPENAI_MAX_TOKENS', '2000'))
        self.temperature = float(os.environ.get('OPENAI_TEMPERATURE', '0.7'))
        self.enabled = os.environ.get('ENABLE_AI_FEATURES', 'false').lower() == 'true'
        
        if self.enabled and self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        elif self.enabled:
            logger.warning("AI features enabled but no OpenAI API key provided")
            self.enabled = False
            self.client = None
        else:
            self.client = None
    
    def is_enabled(self) -> bool:
        return self.enabled and self.api_key is not None and self.client is not None
    
    def _make_openai_request(self, messages: List[Dict], max_tokens: Optional[int] = None) -> Optional[str]:
        """Make a request to OpenAI API with error handling"""
        if not self.is_enabled():
            return None
            
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens or self.max_tokens,
                temperature=self.temperature
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return None
    
    def summarize_email(self, subject: str, body: str, sender: str = "") -> Optional[str]:
        """Summarize an email's content"""
        if not self.is_enabled():
            return None
            
        # Truncate body if too long (keep within token limits)
        max_body_length = 3000
        if len(body) > max_body_length:
            body = body[:max_body_length] + "..."
        
        messages = [
            {
                "role": "system",
                "content": "You are an AI assistant that helps users understand and manage their emails. Provide clear, concise summaries."
            },
            {
                "role": "user",
                "content": f"""Please provide a brief summary of this email:

Subject: {subject}
From: {sender}
Content: {body}

Provide a 2-3 sentence summary focusing on the main points and any action items."""
            }
        ]
        
        return self._make_openai_request(messages, max_tokens=200)
    
    def extract_action_items(self, subject: str, body: str) -> Optional[List[str]]:
        """Extract action items from an email"""
        if not self.is_enabled():
            return None
            
        max_body_length = 3000
        if len(body) > max_body_length:
            body = body[:max_body_length] + "..."
        
        messages = [
            {
                "role": "system",
                "content": "You are an AI assistant that identifies action items and tasks from emails. Return only a JSON array of strings."
            },
            {
                "role": "user",
                "content": f"""Extract any action items, tasks, or things that need to be done from this email:

Subject: {subject}
Content: {body}

Return a JSON array of action items. If no action items are found, return an empty array []. Each action item should be a clear, actionable statement."""
            }
        ]
        
        response = self._make_openai_request(messages, max_tokens=300)
        
        if response:
            try:
                # Try to parse as JSON
                action_items = json.loads(response)
                if isinstance(action_items, list):
                    return action_items
            except json.JSONDecodeError:
                # If not valid JSON, try to extract items manually
                lines = response.strip().split('\n')
                action_items = []
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith('[') and not line.startswith(']'):
                        # Remove common prefixes
                        for prefix in ['- ', '• ', '* ', '1. ', '2. ', '3. ', '4. ', '5. ']:
                            if line.startswith(prefix):
                                line = line[len(prefix):]
                                break
                        if line:
                            action_items.append(line)
                return action_items
        
        return None
    
    def compose_reply(self, original_subject: str, original_body: str, original_sender: str, context: str = "") -> Optional[str]:
        """Generate a reply to an email"""
        if not self.is_enabled():
            return None
            
        max_body_length = 2000
        if len(original_body) > max_body_length:
            original_body = original_body[:max_body_length] + "..."
        
        messages = [
            {
                "role": "system",
                "content": "You are an AI assistant that helps compose professional email replies. Write clear, polite, and appropriate responses."
            },
            {
                "role": "user",
                "content": f"""Help me compose a reply to this email:

From: {original_sender}
Subject: {original_subject}
Original message: {original_body}

Additional context: {context}

Generate a professional email reply. Include appropriate salutation and closing. Keep it concise but complete."""
            }
        ]
        
        return self._make_openai_request(messages, max_tokens=400)
    
    def categorize_email(self, subject: str, body: str, sender: str = "") -> Optional[str]:
        """Categorize an email into types like: urgent, promotional, personal, work, newsletter, etc."""
        if not self.is_enabled():
            return None
            
        max_body_length = 1000
        if len(body) > max_body_length:
            body = body[:max_body_length] + "..."
        
        messages = [
            {
                "role": "system",
                "content": "You are an AI assistant that categorizes emails. Return only one category from: urgent, important, promotional, personal, work, newsletter, social, notification, spam, other"
            },
            {
                "role": "user",
                "content": f"""Categorize this email into one of these categories: urgent, important, promotional, personal, work, newsletter, social, notification, spam, other

Subject: {subject}
From: {sender}
Content: {body}

Return only the category name, no additional text."""
            }
        ]
        
        response = self._make_openai_request(messages, max_tokens=10)
        if response:
            # Ensure it's one of our valid categories
            valid_categories = ['urgent', 'important', 'promotional', 'personal', 'work', 'newsletter', 'social', 'notification', 'spam', 'other']
            response_lower = response.lower().strip()
            if response_lower in valid_categories:
                return response_lower
        
        return 'other'
    
    def improve_email_draft(self, draft_content: str, improvement_type: str = "general") -> Optional[str]:
        """Improve an email draft for clarity, tone, grammar, etc."""
        if not self.is_enabled():
            return None
        
        improvement_prompts = {
            "general": "Improve this email for clarity, professionalism, and effectiveness",
            "formal": "Make this email more formal and professional",
            "casual": "Make this email more casual and friendly",
            "concise": "Make this email more concise while keeping the key information",
            "grammar": "Correct any grammar, spelling, or punctuation errors in this email"
        }
        
        prompt = improvement_prompts.get(improvement_type, improvement_prompts["general"])
        
        messages = [
            {
                "role": "system",
                "content": "You are an AI assistant that helps improve email writing. Provide improved versions that are clear, appropriate, and effective."
            },
            {
                "role": "user",
                "content": f"""{prompt}:

{draft_content}

Return only the improved email content, maintaining the same general structure and intent."""
            }
        ]
        
        return self._make_openai_request(messages, max_tokens=600)
    
    def generate_email_content(self, content_type: str, original_email_context: Optional[Dict] = None) -> Optional[str]:
        """Generate email content based on type and context"""
        if not self.is_enabled():
            return None
        
        content_prompts = {
            "professional": "Write a professional business email",
            "followup": "Write a polite follow-up email",
            "thankyou": "Write a thank you email",
            "meeting": "Write an email to schedule a meeting"
        }
        
        base_prompt = content_prompts.get(content_type, content_prompts["professional"])
        
        # If we have original email context (for replies), use it
        if original_email_context:
            original_subject = original_email_context.get('subject', '')
            original_body = original_email_context.get('body', '')
            original_sender = original_email_context.get('sender', '')
            
            # Truncate original body if too long
            max_body_length = 1500
            if len(original_body) > max_body_length:
                original_body = original_body[:max_body_length] + "..."
            
            messages = [
                {
                    "role": "system",
                    "content": "You are an AI assistant that helps compose contextual email content based on previous correspondence. Write clear, professional, and relevant emails."
                },
                {
                    "role": "user",
                    "content": f"""Based on this original email, {base_prompt}:

Original Email:
From: {original_sender}
Subject: {original_subject}
Content: {original_body}

Generate appropriate email content that references or responds to the original email context. Include proper salutation and closing."""
                }
            ]
        else:
            # No context, generate generic content
            messages = [
                {
                    "role": "system",
                    "content": "You are an AI assistant that helps compose professional email content. Write clear, polite, and effective emails."
                },
                {
                    "role": "user",
                    "content": f"""{base_prompt}. Include appropriate salutation and closing. Make it professional but not overly formal."""
                }
            ]
        
        return self._make_openai_request(messages, max_tokens=500)
    
    def answer_question_about_email(self, question: str, subject: str, body: str, sender: str = "") -> Optional[str]:
        """Answer questions about a specific email"""
        if not self.is_enabled():
            return None
            
        max_body_length = 2500
        if len(body) > max_body_length:
            body = body[:max_body_length] + "..."
        
        messages = [
            {
                "role": "system",
                "content": "You are an AI assistant that helps users understand and analyze their emails. Answer questions clearly and accurately based on the email content."
            },
            {
                "role": "user",
                "content": f"""Based on this email, please answer the following question:

Email Subject: {subject}
From: {sender}
Email Content: {body}

Question: {question}

Provide a clear, helpful answer based on the email content."""
            }
        ]
        
        return self._make_openai_request(messages, max_tokens=300)

# Global instance
ai_service = AIService() 