import { query } from "./_generated/server";

// Debug queries to help troubleshoot epic assignment issues
export const debugTaskEpicData = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").take(10);
    const epics = await ctx.db.query("epics").take(10);
    
    return {
      tasks: tasks.map(t => ({
        _id: t._id,
        title: t.title,
        epicId: t.epicId,
        hasEpicId: !!t.epicId
      })),
      epics: epics.map(e => ({
        _id: e._id,
        title: e.title,
        taskIds: e.taskIds
      })),
      summary: {
        totalTasks: tasks.length,
        tasksWithEpic: tasks.filter(t => t.epicId).length,
        tasksWithoutEpic: tasks.filter(t => !t.epicId).length,
        totalEpics: epics.length
      }
    };
  }
});

export const debugEpicTaskRelationships = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    const epics = await ctx.db.query("epics").collect();
    
    const orphanedTasks = tasks.filter(t => !t.epicId);
    const tasksWithInvalidEpics = tasks.filter(t => {
      if (!t.epicId) return false;
      return !epics.find(e => e._id === t.epicId);
    });
    
    return {
      orphanedTasks: orphanedTasks.map(t => ({ id: t._id, title: t.title })),
      tasksWithInvalidEpics: tasksWithInvalidEpics.map(t => ({ 
        id: t._id, 
        title: t.title, 
        epicId: t.epicId 
      })),
      epicTaskCounts: epics.map(epic => ({
        epicId: epic._id,
        epicTitle: epic.title,
        declaredTaskCount: epic.taskIds?.length || 0,
        actualTaskCount: tasks.filter(t => t.epicId === epic._id).length
      }))
    };
  }
});