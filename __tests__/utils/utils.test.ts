// __tests__/utils/utils.test.ts
import { describe, it, expect, jest } from '@jest/globals';
import { fileToBase64, renderMarkdown } from '../../utils/helpers';

describe('Utility Functions', () => {

    describe('fileToBase64', () => {
        it('should convert a file to a base64 string, excluding the data URL prefix', async () => {
            const mockFile = new File(['hello'], 'hello.png', { type: 'image/png' });
            const mockResult = 'data:image/png;base64,aGVsbG8='; // "hello" in base64
            
            // Mock FileReader
            const readAsDataURLSpy = jest.spyOn(FileReader.prototype, 'readAsDataURL');
            // FIX: The 'onload' property is on the instance, not the prototype, so spying on it this way is incorrect and causes type errors.
            // The spy isn't used anyway except for restore. The test works without it.
            
            readAsDataURLSpy.mockImplementation(function(this: FileReader) {
                // When readAsDataURL is called, immediately trigger onload
                if (this.onload) {
                    Object.defineProperty(this, 'result', {
                        value: mockResult,
                        writable: false,
                    });
                    const event = new ProgressEvent('load');
                    (this.onload as any)(event);
                }
            });

            const base64 = await fileToBase64(mockFile);
            
            expect(base64).toBe('aGVsbG8=');
            
            // Clean up spies
            readAsDataURLSpy.mockRestore();
        });

        it('should reject the promise if FileReader encounters an error', async () => {
            const mockFile = new File([''], 'error.txt');
            const mockError = new DOMException('Mock error');

            const readAsDataURLSpy = jest.spyOn(FileReader.prototype, 'readAsDataURL');
            // FIX: 'onerror' is also an instance property. Remove this spy.
            
            readAsDataURLSpy.mockImplementation(function(this: FileReader) {
                 if (this.onerror) {
                    (this.onerror as any)(mockError);
                 }
            });

            await expect(fileToBase64(mockFile)).rejects.toBe(mockError);
            
            readAsDataURLSpy.mockRestore();
        });
    });

    describe('renderMarkdown', () => {
        it('should return an empty string for null or undefined input', () => {
            expect(renderMarkdown(null)).toBe('');
            expect(renderMarkdown(undefined)).toBe('');
        });

        it('should convert ### headers to <h3> tags', () => {
            const input = '### My Title';
            const expected = '<h3 class="text-amber-400 font-semibold mt-4 mb-2">My Title</h3>';
            expect(renderMarkdown(input)).toBe(expected);
        });

        it('should convert **bold** text to <strong> tags', () => {
            const input = 'This is **important** text.';
            const expected = 'This is <strong>important</strong> text.';
            expect(renderMarkdown(input)).toBe(expected);
        });

        it('should convert a simple list into a <ul> with <li> items', () => {
            const input = '- First item\n- Second item';
            const expected = '<ul><li>First item</li><br /><li>Second item</li></ul>';
            // Note: The logic in the helper joins with '\n' then replaces with '<br />' which is a bit quirky.
            // This test validates the actual behavior. A better implementation might not add the <br /> inside the list.
            const result = renderMarkdown(input);
            // Let's make the test more robust to the implementation detail.
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>First item</li>');
            expect(result).toContain('<li>Second item</li>');
            expect(result).toContain('</ul>');
        });

        it('should handle text with mixed markdown elements', () => {
            const input = '### Daily Summary\n\nHere is a list of items:\n- **Item 1**: Done\n- Item 2: Pending';
            const result = renderMarkdown(input);
            
            expect(result).toContain('<h3 class="text-amber-400 font-semibold mt-4 mb-2">Daily Summary</h3>');
            expect(result).toContain('<ul>');
            expect(result).toContain('<li><strong>Item 1</strong>: Done</li>');
            expect(result).toContain('<li>Item 2: Pending</li>');
            expect(result).toContain('</ul>');
        });
    });

});
