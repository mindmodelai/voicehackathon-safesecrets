import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeartAvatar, getVideoSourceForState } from './HeartAvatar';
// Stub HTMLMediaElement.prototype methods for jsdom
beforeEach(() => {
    vi.stubGlobal('HTMLMediaElement', class extends HTMLMediaElement {
    });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.load = vi.fn();
});
describe('getVideoSourceForState', () => {
    it.each([
        ['idle', 'soft', '/videos/idle.mp4'],
        ['listening', 'soft', '/videos/listening.mp4'],
        ['thinking', 'serious', '/videos/thinking.mp4'],
        ['speaking', 'soft', '/videos/speaking-soft.mp4'],
        ['speaking', 'flirty', '/videos/speaking-flirty.mp4'],
        ['speaking', 'serious', '/videos/speaking-serious.mp4'],
    ])('returns %s for state=%s style=%s', (state, style, expected) => {
        expect(getVideoSourceForState(state, style)).toBe(expected);
    });
    it('ignores speakingStyle for non-speaking states', () => {
        const styles = ['soft', 'flirty', 'serious'];
        for (const style of styles) {
            expect(getVideoSourceForState('idle', style)).toBe('/videos/idle.mp4');
            expect(getVideoSourceForState('listening', style)).toBe('/videos/listening.mp4');
            expect(getVideoSourceForState('thinking', style)).toBe('/videos/thinking.mp4');
        }
    });
});
describe('HeartAvatar', () => {
    it('renders a video element with correct source for idle state', () => {
        render(_jsx(HeartAvatar, { avatarState: "idle", speakingStyle: "soft" }));
        const video = screen.getByTestId('heart-avatar-video');
        expect(video.getAttribute('src')).toBe('/videos/idle.mp4');
    });
    it('renders a video element with correct source for listening state', () => {
        render(_jsx(HeartAvatar, { avatarState: "listening", speakingStyle: "soft" }));
        const video = screen.getByTestId('heart-avatar-video');
        expect(video.getAttribute('src')).toBe('/videos/listening.mp4');
    });
    it('renders a video element with correct source for thinking state', () => {
        render(_jsx(HeartAvatar, { avatarState: "thinking", speakingStyle: "soft" }));
        const video = screen.getByTestId('heart-avatar-video');
        expect(video.getAttribute('src')).toBe('/videos/thinking.mp4');
    });
    it('renders speaking-soft video when speaking with soft style', () => {
        render(_jsx(HeartAvatar, { avatarState: "speaking", speakingStyle: "soft" }));
        const video = screen.getByTestId('heart-avatar-video');
        expect(video.getAttribute('src')).toBe('/videos/speaking-soft.mp4');
    });
    it('renders speaking-flirty video when speaking with flirty style', () => {
        render(_jsx(HeartAvatar, { avatarState: "speaking", speakingStyle: "flirty" }));
        const video = screen.getByTestId('heart-avatar-video');
        expect(video.getAttribute('src')).toBe('/videos/speaking-flirty.mp4');
    });
    it('renders speaking-serious video when speaking with serious style', () => {
        render(_jsx(HeartAvatar, { avatarState: "speaking", speakingStyle: "serious" }));
        const video = screen.getByTestId('heart-avatar-video');
        expect(video.getAttribute('src')).toBe('/videos/speaking-serious.mp4');
    });
    it('sets loop, autoPlay, muted, and playsInline attributes on the video', () => {
        render(_jsx(HeartAvatar, { avatarState: "idle", speakingStyle: "soft" }));
        const video = screen.getByTestId('heart-avatar-video');
        expect(video).toHaveAttribute('loop');
        // muted is a DOM property in jsdom, not an attribute
        expect(video.muted).toBe(true);
    });
    it('applies state-specific CSS class to the container', () => {
        const { container, rerender } = render(_jsx(HeartAvatar, { avatarState: "idle", speakingStyle: "soft" }));
        expect(container.querySelector('.heart-avatar--idle')).toBeInTheDocument();
        rerender(_jsx(HeartAvatar, { avatarState: "listening", speakingStyle: "soft" }));
        expect(container.querySelector('.heart-avatar--listening')).toBeInTheDocument();
        rerender(_jsx(HeartAvatar, { avatarState: "thinking", speakingStyle: "soft" }));
        expect(container.querySelector('.heart-avatar--thinking')).toBeInTheDocument();
        rerender(_jsx(HeartAvatar, { avatarState: "speaking", speakingStyle: "flirty" }));
        expect(container.querySelector('.heart-avatar--speaking')).toBeInTheDocument();
    });
    it('has accessible role and label', () => {
        render(_jsx(HeartAvatar, { avatarState: "idle", speakingStyle: "soft" }));
        expect(screen.getByRole('img', { name: /heart avatar — idle/i })).toBeInTheDocument();
    });
    it('updates aria-label when state changes', () => {
        const { rerender } = render(_jsx(HeartAvatar, { avatarState: "idle", speakingStyle: "soft" }));
        expect(screen.getByRole('img', { name: /heart avatar — idle/i })).toBeInTheDocument();
        rerender(_jsx(HeartAvatar, { avatarState: "speaking", speakingStyle: "flirty" }));
        expect(screen.getByRole('img', { name: /heart avatar — speaking/i })).toBeInTheDocument();
    });
    it('switches video source when avatarState changes', () => {
        const { rerender } = render(_jsx(HeartAvatar, { avatarState: "idle", speakingStyle: "soft" }));
        const video = screen.getByTestId('heart-avatar-video');
        expect(video.getAttribute('src')).toBe('/videos/idle.mp4');
        rerender(_jsx(HeartAvatar, { avatarState: "listening", speakingStyle: "soft" }));
        expect(video.getAttribute('src')).toBe('/videos/listening.mp4');
    });
    it('switches video source when speakingStyle changes during speaking state', () => {
        const { rerender } = render(_jsx(HeartAvatar, { avatarState: "speaking", speakingStyle: "soft" }));
        const video = screen.getByTestId('heart-avatar-video');
        expect(video.getAttribute('src')).toBe('/videos/speaking-soft.mp4');
        rerender(_jsx(HeartAvatar, { avatarState: "speaking", speakingStyle: "serious" }));
        expect(video.getAttribute('src')).toBe('/videos/speaking-serious.mp4');
    });
    it('hides the video element from screen readers', () => {
        render(_jsx(HeartAvatar, { avatarState: "idle", speakingStyle: "soft" }));
        const video = screen.getByTestId('heart-avatar-video');
        expect(video).toHaveAttribute('aria-hidden', 'true');
    });
});
//# sourceMappingURL=HeartAvatar.test.js.map