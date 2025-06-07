"""
Email Content Analyzer
Intelligently detects email types and provides styling recommendations
"""

from bs4 import BeautifulSoup, Comment
import re
from typing import Dict, Any, Optional


class EmailAnalyzer:
    """Analyzes email content to determine display strategy"""
    
    def __init__(self):
        # Patterns that indicate designed emails
        self.design_indicators = [
            'newsletter', 'marketing', 'campaign', 'template',
            'table', 'layout', 'grid', 'column', 'responsive'
        ]
        
        # CSS properties that indicate intentional design
        self.design_css_properties = [
            'background-color', 'background-image', 'border-radius',
            'box-shadow', 'gradient', 'flex', 'grid', 'float',
            'position: absolute', 'position: fixed', 'z-index'
        ]
        
        # HTML attributes that indicate design
        self.design_attributes = [
            'bgcolor', 'background', 'cellpadding', 'cellspacing',
            'valign', 'align="center"', 'width=', 'height='
        ]

    def analyze_email(self, html_content: str, text_content: str = "") -> Dict[str, Any]:
        """
        Analyze email content and return styling recommendations
        
        Args:
            html_content (str): HTML content of the email
            text_content (str): Plain text content of the email
            
        Returns:
            Dict containing analysis results and recommendations
        """
        if not html_content or html_content.strip() == "":
            return self._text_email_result()
        
        # Parse HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Calculate various scores
        design_score = self._calculate_design_score(soup, html_content)
        complexity_score = self._calculate_complexity_score(soup)
        table_score = self._calculate_table_score(soup)
        styling_score = self._calculate_styling_score(soup, html_content)
        content_structure_score = self._calculate_content_structure_score(soup)
        
        # Determine email type
        email_type = self._determine_email_type(
            design_score, complexity_score, table_score, 
            styling_score, content_structure_score
        )
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            email_type, design_score, complexity_score, table_score
        )
        
        return {
            'email_type': email_type,
            'design_score': design_score,
            'complexity_score': complexity_score,
            'table_score': table_score,
            'styling_score': styling_score,
            'content_structure_score': content_structure_score,
            'recommendations': recommendations,
            'should_preserve_layout': email_type in ['designed', 'newsletter', 'marketing'],
            'should_force_left_align': email_type in ['plain_text', 'simple_html'],
            'cleaned_html': self._clean_html_if_needed(soup, email_type)
        }

    def _text_email_result(self) -> Dict[str, Any]:
        """Return result for plain text emails"""
        return {
            'email_type': 'plain_text',
            'design_score': 0,
            'complexity_score': 0,
            'table_score': 0,
            'styling_score': 0,
            'content_structure_score': 0,
            'recommendations': {
                'alignment': 'left',
                'preserve_layout': False,
                'apply_restrictions': True
            },
            'should_preserve_layout': False,
            'should_force_left_align': True,
            'cleaned_html': None
        }

    def _calculate_design_score(self, soup: BeautifulSoup, html_content: str) -> float:
        """Calculate how 'designed' the email appears to be"""
        score = 0.0
        
        # Check for design-related terms in HTML
        html_lower = html_content.lower()
        for indicator in self.design_indicators:
            if indicator in html_lower:
                score += 1.0
        
        # Check for CSS design properties
        for prop in self.design_css_properties:
            if prop in html_lower:
                score += 0.5
        
        # Check for design attributes
        for attr in self.design_attributes:
            if attr in html_lower:
                score += 0.3
        
        # Check for images
        images = soup.find_all('img')
        if len(images) > 0:
            score += min(len(images) * 0.5, 3.0)  # Cap at 3.0
        
        # Check for links (designed emails often have many links)
        links = soup.find_all('a')
        if len(links) > 2:
            score += min(len(links) * 0.2, 2.0)  # Cap at 2.0
        
        return min(score, 10.0)  # Cap total score at 10.0

    def _calculate_complexity_score(self, soup: BeautifulSoup) -> float:
        """Calculate structural complexity"""
        score = 0.0
        
        # Count nested elements
        all_elements = soup.find_all()
        score += min(len(all_elements) * 0.1, 5.0)
        
        # Check for nested divs (common in designed emails)
        nested_divs = soup.find_all('div')
        for div in nested_divs:
            nested_count = len(div.find_all('div'))
            if nested_count > 2:
                score += 1.0
        
        # Check for complex structures
        if soup.find_all('table'):
            score += 1.0
        if soup.find_all('td'):
            score += 0.5
        if soup.find_all('span'):
            score += 0.3
        
        return min(score, 10.0)

    def _calculate_table_score(self, soup: BeautifulSoup) -> float:
        """Calculate table-based layout complexity"""
        score = 0.0
        
        tables = soup.find_all('table')
        score += len(tables) * 1.0
        
        # Check for nested tables (strong indicator of designed email)
        for table in tables:
            nested_tables = table.find_all('table')
            if nested_tables:
                score += len(nested_tables) * 2.0
        
        # Check for table attributes that indicate design
        for table in tables:
            if table.get('width') or table.get('cellpadding') or table.get('cellspacing'):
                score += 1.0
            if table.get('bgcolor') or table.get('background'):
                score += 1.0
        
        return min(score, 10.0)

    def _calculate_styling_score(self, soup: BeautifulSoup, html_content: str) -> float:
        """Calculate inline and embedded styling complexity"""
        score = 0.0
        
        # Check for style tags
        style_tags = soup.find_all('style')
        if style_tags:
            score += len(style_tags) * 2.0
        
        # Check for inline styles
        elements_with_style = soup.find_all(attrs={"style": True})
        score += min(len(elements_with_style) * 0.2, 3.0)
        
        # Check for CSS classes (indicates structured styling)
        elements_with_class = soup.find_all(attrs={"class": True})
        if len(elements_with_class) > 5:
            score += 1.0
        
        # Check for color attributes
        if 'color:' in html_content or 'background:' in html_content:
            score += 1.0
        
        return min(score, 10.0)

    def _calculate_content_structure_score(self, soup: BeautifulSoup) -> float:
        """Calculate content organization complexity"""
        score = 0.0
        
        # Check for headers
        headers = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        if headers:
            score += min(len(headers) * 0.5, 2.0)
        
        # Check for lists
        lists = soup.find_all(['ul', 'ol', 'li'])
        if lists:
            score += min(len(lists) * 0.3, 1.5)
        
        # Check for paragraphs vs divs (p tags indicate structured content)
        paragraphs = soup.find_all('p')
        divs = soup.find_all('div')
        
        if len(paragraphs) > len(divs):
            score += 1.0  # More semantic structure
        elif len(divs) > len(paragraphs) * 2:
            score += 2.0  # Likely designed layout
        
        return min(score, 10.0)

    def _determine_email_type(self, design_score: float, complexity_score: float, 
                            table_score: float, styling_score: float, 
                            content_structure_score: float) -> str:
        """Determine the email type based on scores"""
        
        total_score = design_score + complexity_score + table_score + styling_score + content_structure_score
        
        # High design indicators = designed email
        if design_score >= 3.0 or table_score >= 3.0 or styling_score >= 3.0:
            if total_score >= 10.0:
                return 'newsletter'  # Complex designed email
            else:
                return 'designed'    # Moderately designed email
        
        # Medium complexity = rich HTML
        elif complexity_score >= 2.0 or total_score >= 5.0:
            return 'rich_html'
        
        # Low complexity = simple HTML (likely text wrapped in basic HTML)
        elif total_score <= 2.0:
            return 'simple_html'
        
        # Default fallback
        else:
            return 'plain_text'

    def _generate_recommendations(self, email_type: str, design_score: float, 
                                complexity_score: float, table_score: float) -> Dict[str, Any]:
        """Generate styling and display recommendations"""
        
        if email_type in ['newsletter', 'designed']:
            return {
                'alignment': 'preserve',
                'preserve_layout': True,
                'apply_restrictions': False,
                'max_width': 'none',
                'force_responsive': False
            }
        
        elif email_type == 'rich_html':
            return {
                'alignment': 'preserve',
                'preserve_layout': True,
                'apply_restrictions': False,
                'max_width': '800px',
                'force_responsive': True
            }
        
        else:  # simple_html, plain_text
            return {
                'alignment': 'left',
                'preserve_layout': False,
                'apply_restrictions': True,
                'max_width': '100%',
                'force_responsive': True
            }

    def _clean_html_if_needed(self, soup: BeautifulSoup, email_type: str) -> Optional[str]:
        """Clean HTML for simple emails that need left alignment"""
        
        if email_type not in ['simple_html', 'plain_text']:
            return None  # Don't modify designed emails
        
        # For simple emails, remove center alignment
        for element in soup.find_all():
            # Remove center alignment attributes
            if element.get('align') in ['center', 'right']:
                element['align'] = 'left'
            
            # Modify inline styles
            style = element.get('style', '')
            if style:
                # Remove center/right text alignment
                style = re.sub(r'text-align\s*:\s*(center|right)', 'text-align: left', style, flags=re.IGNORECASE)
                # Remove auto margins that might center content
                style = re.sub(r'margin\s*:\s*[^;]*auto[^;]*', 'margin: 0', style, flags=re.IGNORECASE)
                style = re.sub(r'margin-(left|right)\s*:\s*auto', r'margin-\1: 0', style, flags=re.IGNORECASE)
                element['style'] = style
        
        # Replace center tags with left-aligned divs
        for center_tag in soup.find_all('center'):
            center_tag.name = 'div'
            center_tag['style'] = 'text-align: left;'
        
        return str(soup)


# Singleton instance
email_analyzer = EmailAnalyzer()


def analyze_email_content(html_content: str, text_content: str = "") -> Dict[str, Any]:
    """
    Convenient function to analyze email content
    
    Args:
        html_content (str): HTML content of the email
        text_content (str): Plain text content of the email
        
    Returns:
        Dict containing analysis results and recommendations
    """
    return email_analyzer.analyze_email(html_content, text_content) 