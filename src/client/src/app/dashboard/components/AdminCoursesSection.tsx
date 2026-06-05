"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    fetchCourses,
    createCourse,
    updateCourse,
    type Course,
} from "@/services/courses.service";

export function AdminCoursesSection() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [term, setTerm] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editCode, setEditCode] = useState("");
    const [editName, setEditName] = useState("");
    const [editTerm, setEditTerm] = useState("");
    const [statusTarget, setStatusTarget] = useState<Course | null>(null);

    const loadCourses = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchCourses(false);
            setCourses(data);
        } catch (e) {
            console.error(e);
            setError("Could not load courses.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCourses();
    }, []);

    const handleCreateCourse = async () => {
        if (!code.trim() || !name.trim()) {
            setError("Course code and name are required.");
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await createCourse({
                code: code.trim(),
                name: name.trim(),
                term: term.trim() || undefined,
            });
            setCode("");
            setName("");
            setTerm("");
            await loadCourses();
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to create course.");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleCourseActive = async (course: Course) => {
        try {
            setError(null);
            await updateCourse(course.course_id, { active: !course.active });
            await loadCourses();
            return true;
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to update course status.");
            return false;
        }
    };

    const startEdit = (course: Course) => {
        setEditingId(course.course_id);
        setEditCode(course.code);
        setEditName(course.name);
        setEditTerm(course.term || "");
        setError(null);
    };

    const saveEdit = async (course: Course) => {
        if (!editCode.trim() || !editName.trim()) {
            setError("Course code and name are required.");
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await updateCourse(course.course_id, {
                code: editCode.trim(),
                name: editName.trim(),
                term: editTerm.trim() || undefined,
            });
            setEditingId(null);
            await loadCourses();
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to update course details.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Create Course</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Input
                            placeholder="Code (e.g. SE390)"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />
                        <Input
                            placeholder="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <Input
                            placeholder="Term (optional)"
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleCreateCourse} disabled={submitting}>
                        {submitting ? "Creating..." : "Create Course"}
                    </Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Course Lifecycle</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-slate-600">Loading courses...</p>
                    ) : courses.length === 0 ? (
                        <p className="text-slate-600">No courses found.</p>
                    ) : (
                        <div className="space-y-3">
                            {courses.map((course) => {
                                const isEditing = editingId === course.course_id;
                                return (
                                    <div
                                        key={course.course_id}
                                        className="border border-slate-200 rounded-md p-3 space-y-3"
                                    >
                                        {isEditing ? (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <Input
                                                    value={editCode}
                                                    onChange={(event) =>
                                                        setEditCode(event.target.value)
                                                    }
                                                />
                                                <Input
                                                    value={editName}
                                                    onChange={(event) =>
                                                        setEditName(event.target.value)
                                                    }
                                                />
                                                <Input
                                                    value={editTerm}
                                                    onChange={(event) =>
                                                        setEditTerm(event.target.value)
                                                    }
                                                    placeholder="Term"
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="font-medium text-slate-900">
                                                    {course.code} - {course.name}
                                                </p>
                                                <p className="text-sm text-slate-600">
                                                    Term: {course.term || "N/A"} | Status:{" "}
                                                    {course.active ? "Active" : "Inactive"}
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {isEditing ? (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        onClick={() => saveEdit(course)}
                                                        disabled={submitting}
                                                    >
                                                        Save Details
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => startEdit(course)}
                                                >
                                                    Edit Details
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                onClick={() => setStatusTarget(course)}
                                            >
                                                Set {course.active ? "Inactive" : "Active"}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
            <Dialog
                open={!!statusTarget}
                onOpenChange={(open) => !open && setStatusTarget(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Set Course {statusTarget?.active ? "Inactive" : "Active"}
                        </DialogTitle>
                        <DialogDescription>
                            This only updates the course lifecycle label. Existing
                            students, teams, capstones, invites, and reviews stay intact.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {statusTarget
                            ? `${statusTarget.code} - ${statusTarget.name}`
                            : ""}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" disabled={submitting}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            onClick={async () => {
                                if (!statusTarget) return;
                                setSubmitting(true);
                                const saved = await toggleCourseActive(statusTarget);
                                setSubmitting(false);
                                if (saved) {
                                    setStatusTarget(null);
                                }
                            }}
                            disabled={submitting}
                        >
                            {submitting
                                ? "Saving..."
                                : `Set ${statusTarget?.active ? "Inactive" : "Active"}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

