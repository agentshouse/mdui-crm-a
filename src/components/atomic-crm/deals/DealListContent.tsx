import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import { useDataProvider, useListContext, useNotify } from "ra-core";
import { useMemo, useRef, useState } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { DealColumn } from "./DealColumn";
import { getDealsByStage } from "./stages";

export const DealListContent = () => {
  const { dealStages } = useConfigurationContext();
  const { data: unorderedDeals, isPending, refetch } = useListContext<Deal>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [isMoving, setIsMoving] = useState(false);
  const movingRef = useRef(false);
  const dealsByStage = useMemo(
    () => getDealsByStage(unorderedDeals ?? [], dealStages),
    [unorderedDeals, dealStages],
  );

  if (isPending) return null;

  const onDragEnd: OnDragEndResponder = async ({ destination, source }) => {
    if (
      !destination ||
      movingRef.current ||
      (destination.droppableId === source.droppableId &&
        destination.index === source.index)
    )
      return;

    const sourceDeal = dealsByStage[source.droppableId]?.[source.index];
    if (!sourceDeal) return;
    const destinationStage = destination.droppableId;
    // A filtered board can hide cards. Anchor the move to its visible neighbor,
    // then include the complete destination column in the atomic Room mutation.
    const visibleDestination = dealsByStage[destinationStage].filter(
      (deal) => deal.id !== sourceDeal.id,
    );
    const nextVisible = visibleDestination[destination.index];
    const previousVisible = visibleDestination[destination.index - 1];
    movingRef.current = true;
    setIsMoving(true);
    try {
      const { data: destinationDeals } = await dataProvider.getList<Deal>(
        "deals",
        {
          sort: { field: "index", order: "ASC" },
          pagination: { page: 1, perPage: 10000 },
          filter: { stage: destinationStage, "archived_at@is": null },
        },
      );
      const ordered = destinationDeals.filter(
        (deal) => deal.id !== sourceDeal.id,
      );
      const nextIndex = nextVisible
        ? ordered.findIndex((deal) => deal.id === nextVisible.id)
        : -1;
      const previousIndex = previousVisible
        ? ordered.findIndex((deal) => deal.id === previousVisible.id)
        : -1;
      const insertionIndex =
        nextIndex >= 0
          ? nextIndex
          : previousIndex >= 0
            ? previousIndex + 1
            : ordered.length;
      ordered.splice(insertionIndex, 0, sourceDeal);
      await dataProvider.moveDeal(sourceDeal, destinationStage, ordered);
      await refetch();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not move deal. Please try again.",
        { type: "error" },
      );
      await refetch();
    } finally {
      movingRef.current = false;
      setIsMoving(false);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4" aria-busy={isMoving}>
        {dealStages.map((stage) => (
          <DealColumn
            stage={stage.value}
            deals={dealsByStage[stage.value]}
            key={stage.value}
            isDragDisabled={isMoving}
          />
        ))}
      </div>
    </DragDropContext>
  );
};
