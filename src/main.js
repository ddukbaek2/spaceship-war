//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../libs/vanilla.js/src/base/vector2.js";
import { Engine, EngineConfiguration } from "../libs/vanilla.js/src/core/engine.js";
import { Graphic } from "../libs/vanilla.js/src/core/graphic.js";
import { Scene } from "../libs/vanilla.js/src/core/scene.js";
import { ViewScaleMode } from "../libs/vanilla.js/src/core/viewmanager.js";


//==============================================================================
// 전역 상수 목록.
//==============================================================================
const GRID_COLUMNS = 5;
const GRID_ROWS = 5;
const EMPTY_CELL = -1;
const CORE_PART_INDEX = 0;
const CORE_COLUMN = 2;
const CORE_ROW = 2;
const ADJACENT_OFFSETS = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1],
];
const NO_SELECTION = -1;
const START_GOLD = 100;
const START_LEVEL = 1;
const ATTACHMENT_PART_INDICES = [1, 2, 3];
const SCROLL_DRAG_THRESHOLD = 12;
const DRAG_MODE_NONE = "none";
const DRAG_MODE_PENDING = "pending";
const DRAG_MODE_SCROLL = "scroll";
const DRAG_MODE_ATTACH = "attach";
const INVENTORY_COLUMNS = 2;
const BATTLE_PHASE_FIGHTING = "fighting";
const BATTLE_PHASE_FINISHED = "finished";
const BEAM_SPEED_RATIO = 1.1;
const FIRE_PERIOD = 0.8;
const SHIP_MOVE_FREQUENCY = 1.6;
const BEAM_WIDTH = 7;
const BEAM_HEIGHT = 20;


//==============================================================================
// 앱 탭 식별자.
//==============================================================================
const AppTab = {
	build: 0,
	shop: 1,
	battle: 2,
	settings: 3,
};


//==============================================================================
// 부품 정의 목록. (배열 인덱스가 부품 식별자로 사용된다.)
// health/attack/speed 는 현재 MVP 전투(우주선 단위 체력)용.
// durability/weaponRange/weaponDamage/fireInterval 은 부품 단위 전투(예정)용 데이터.
//==============================================================================
const PartDefinitions = [
	{
		name: "코어",
		symbol: "C",
		color: "#ffd24a",
		price: 0,
		health: 50,
		attack: 0,
		speed: 0,
		durability: 100,
		weaponRange: 0,
		weaponDamage: 0,
		fireInterval: 0,
		maxAttachments: 8,
	},
	{
		name: "무기",
		symbol: "W",
		color: "#ff5a5a",
		price: 30,
		health: 0,
		attack: 10,
		speed: 0,
		durability: 20,
		weaponRange: 3,
		weaponDamage: 10,
		fireInterval: 1.0,
	},
	{
		name: "추진체",
		symbol: "T",
		color: "#56b6ff",
		price: 20,
		health: 0,
		attack: 0,
		speed: 5,
		durability: 15,
		weaponRange: 0,
		weaponDamage: 0,
		fireInterval: 0,
	},
	{
		name: "장갑",
		symbol: "A",
		color: "#9aa3b2",
		price: 25,
		health: 20,
		attack: 0,
		speed: 0,
		durability: 40,
		weaponRange: 0,
		weaponDamage: 0,
		fireInterval: 0,
	},
];


//==============================================================================
// 빈 그리드 생성. (코어가 중앙에 배치된 상태)
//==============================================================================
/**
 * @returns { Array<Array<number>> }
 */
function createGridWithCore() {
	const grid = System.Array(GRID_COLUMNS).fill(null).map(() => System.Array(GRID_ROWS).fill(EMPTY_CELL));
	grid[CORE_COLUMN][CORE_ROW] = CORE_PART_INDEX;
	return grid;
}


//==============================================================================
// 대상 칸이 다른 부품과 상하좌우로 인접하는지 여부 반환.
//==============================================================================
/**
 * @param { Array<Array<number>> } grid
 * @param { number } column
 * @param { number } row
 * @returns { boolean }
 */
function isAdjacentInGrid(grid, column, row) {
	for (const offset of ADJACENT_OFFSETS) {
		const nextColumn = column + offset[0];
		const nextRow = row + offset[1];
		if (nextColumn >= 0 && nextColumn < GRID_COLUMNS && nextRow >= 0 && nextRow < GRID_ROWS) {
			if (grid[nextColumn][nextRow] !== EMPTY_CELL) {
				return true;
			}
		}
	}
	return false;
}


//==============================================================================
// 모든 부품이 코어와 연결되어 있는지 여부 반환.
//==============================================================================
/**
 * @param { Array<Array<number>> } grid
 * @returns { boolean }
 */
function isAllConnectedInGrid(grid) {
	const visited = System.Array(GRID_COLUMNS).fill(null).map(() => System.Array(GRID_ROWS).fill(false));
	const stack = [];
	stack.push([CORE_COLUMN, CORE_ROW]);
	visited[CORE_COLUMN][CORE_ROW] = true;
	let visitedCount = 0;

	while (stack.length > 0) {
		const cell = stack.pop();
		const column = cell[0];
		const row = cell[1];
		++visitedCount;
		for (const offset of ADJACENT_OFFSETS) {
			const nextColumn = column + offset[0];
			const nextRow = row + offset[1];
			if (nextColumn >= 0 && nextColumn < GRID_COLUMNS && nextRow >= 0 && nextRow < GRID_ROWS) {
				if (grid[nextColumn][nextRow] !== EMPTY_CELL && !visited[nextColumn][nextRow]) {
					visited[nextColumn][nextRow] = true;
					stack.push([nextColumn, nextRow]);
				}
			}
		}
	}

	let totalParts = 0;
	for (let column = 0; column < GRID_COLUMNS; ++column) {
		for (let row = 0; row < GRID_ROWS; ++row) {
			if (grid[column][row] !== EMPTY_CELL) {
				++totalParts;
			}
		}
	}
	return visitedCount === totalParts;
}


//==============================================================================
// 그리드의 합산 스탯 계산.
//==============================================================================
/**
 * @param { Array<Array<number>> } grid
 * @returns { object }
 */
function calculateStatsForGrid(grid) {
	let totalHealth = 0;
	let totalAttack = 0;
	let totalSpeed = 0;

	for (let column = 0; column < GRID_COLUMNS; ++column) {
		for (let row = 0; row < GRID_ROWS; ++row) {
			const partIndex = grid[column][row];
			if (partIndex !== EMPTY_CELL) {
				const partDefinition = PartDefinitions[partIndex];
				totalHealth += partDefinition.health;
				totalAttack += partDefinition.attack;
				totalSpeed += partDefinition.speed;
			}
		}
	}

	return {
		health: totalHealth,
		attack: totalAttack,
		speed: totalSpeed,
	};
}


//==============================================================================
// 적 우주선 템플릿 목록. (유의미한 구성: 무기·추진체·장갑 의도적 배치)
// 각 부품 항목은 [column, row, partIndex] 이며 코어(2,2)는 자동 배치된다.
// partIndex: 1=무기, 2=추진체, 3=장갑.
//==============================================================================
const EnemyTemplates = [
	{
		name: "정찰함",
		parts: [
			[2, 1, 1],
			[2, 3, 2],
		],
	},
	{
		name: "포격함",
		parts: [
			[2, 1, 1],
			[1, 1, 1],
			[3, 1, 1],
			[2, 3, 2],
		],
	},
	{
		name: "돌격함",
		parts: [
			[2, 1, 1],
			[2, 0, 1],
			[2, 3, 2],
			[2, 4, 2],
		],
	},
	{
		name: "균형함",
		parts: [
			[2, 1, 1],
			[1, 1, 1],
			[2, 3, 2],
			[1, 2, 3],
			[3, 2, 3],
		],
	},
	{
		name: "중장갑함",
		parts: [
			[2, 1, 1],
			[1, 1, 3],
			[3, 1, 3],
			[2, 3, 2],
			[1, 2, 3],
			[3, 2, 3],
		],
	},
	{
		name: "요새함",
		parts: [
			[2, 1, 1],
			[1, 1, 3],
			[3, 1, 3],
			[1, 2, 3],
			[3, 2, 3],
			[2, 3, 2],
			[2, 4, 2],
		],
	},
];


//==============================================================================
// 템플릿으로부터 적 우주선 그리드 생성.
//==============================================================================
/**
 * @param { object } template
 * @returns { Array<Array<number>> }
 */
function createEnemyFromTemplate(template) {
	const grid = createGridWithCore();
	const parts = template.parts;
	for (const part of parts) {
		const column = part[0];
		const row = part[1];
		const partIndex = part[2];
		grid[column][row] = partIndex;
	}
	return grid;
}


//==============================================================================
// 메인 앱 씬. (상단 바 + 하단 네비게이션으로 조립/상점/전투/설정 탭 전환)
//==============================================================================
class AppScene extends Scene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @type { number } */ #currentTab;
	/** @type { number } */ #playerLevel;
	/** @type { number } */ #playerGold;
	/** @type { object } */ #inventory;
	/** @type { Array<Array<number>> } */ #grid;
	/** @type { number } */ #draggingPartIndex;
	/** @type { Vector2 } */ #dragPosition;
	/** @type { number } */ #dragCandidatePartIndex;
	/** @type { string } */ #inventoryDragMode;
	/** @type { number } */ #inventoryScrollOffset;
	/** @type { number } */ #inventoryScrollStartY;
	/** @type { number } */ #inventoryScrollStartOffset;
	/** @type { Array<object> } */ #enemyList;
	/** @type { number } */ #selectedEnemyIndex;
	/** @type { number } */ #battleScrollOffset;
	/** @type { number } */ #battleScrollStartOffset;
	/** @type { number } */ #battleScrollDragStartY;
	/** @type { boolean } */ #battleIsScrolling;
	/** @type { object } */ #battleState;

	//==============================================================================
	// 불러오기.
	//==============================================================================
	/**
	 * @override
	 * @param { Engine } engine
	 */
	async load(engine) {
		await super.load(engine);

		const viewManager = engine.getViewManager();
		viewManager.setViewScaleMode(ViewScaleMode.stretchHeight);

		this.reset();
	}

	//==============================================================================
	// 재시작.
	//==============================================================================
	reset() {
		this.#currentTab = AppTab.build;
		this.#playerLevel = START_LEVEL;
		this.#playerGold = START_GOLD;
		this.#inventory = {
			1: 2,
			2: 2,
			3: 2,
		};
		this.#grid = createGridWithCore();
		this.#draggingPartIndex = NO_SELECTION;
		this.#dragPosition = Vector2.zero();
		this.#dragCandidatePartIndex = NO_SELECTION;
		this.#inventoryDragMode = DRAG_MODE_NONE;
		this.#inventoryScrollOffset = 0;
		this.#inventoryScrollStartY = 0;
		this.#inventoryScrollStartOffset = 0;
		this.#enemyList = this.generateEnemies();
		this.#selectedEnemyIndex = NO_SELECTION;
		this.#battleScrollOffset = 0;
		this.#battleScrollStartOffset = 0;
		this.#battleScrollDragStartY = 0;
		this.#battleIsScrolling = false;
		this.#battleState = null;
	}

	//==============================================================================
	// 전투 상태 반환.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getBattleState() {
		return this.#battleState;
	}

	//==============================================================================
	// 현재 탭 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getCurrentTab() {
		return this.#currentTab;
	}

	//==============================================================================
	// 내 레벨 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPlayerLevel() {
		return this.#playerLevel;
	}

	//==============================================================================
	// 내 골드 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPlayerGold() {
		return this.#playerGold;
	}

	//==============================================================================
	// 인벤토리 반환.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getInventory() {
		return this.#inventory;
	}

	//==============================================================================
	// 특정 부품의 보유 수량 반환.
	//==============================================================================
	/**
	 * @param { number } partIndex
	 * @returns { number }
	 */
	getInventoryCount(partIndex) {
		const inventory = this.getInventory();
		return inventory[partIndex];
	}

	//==============================================================================
	// 그리드 반환.
	//==============================================================================
	/**
	 * @returns { Array<Array<number>> }
	 */
	getGrid() {
		return this.#grid;
	}

	//==============================================================================
	// 드래그 중인 부품 인덱스 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getDraggingPartIndex() {
		return this.#draggingPartIndex;
	}

	//==============================================================================
	// 드래그 위치 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getDragPosition() {
		return this.#dragPosition;
	}

	//==============================================================================
	// 적 목록 반환.
	//==============================================================================
	/**
	 * @returns { Array<object> }
	 */
	getEnemyList() {
		return this.#enemyList;
	}

	//==============================================================================
	// 선택된 적 인덱스 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getSelectedEnemyIndex() {
		return this.#selectedEnemyIndex;
	}

	//==============================================================================
	// 적 우주선 목록 생성. (템플릿 기반)
	//==============================================================================
	/**
	 * @returns { Array<object> }
	 */
	generateEnemies() {
		const enemies = [];
		for (const template of EnemyTemplates) {
			const enemyGrid = createEnemyFromTemplate(template);
			const enemyStats = calculateStatsForGrid(enemyGrid);
			enemies.push({
				name: template.name,
				grid: enemyGrid,
				stats: enemyStats,
			});
		}
		return enemies;
	}

	//==============================================================================
	// 코어가 허용하는 최대 부착물 수 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getMaxAttachments() {
		const coreDefinition = PartDefinitions[CORE_PART_INDEX];
		return coreDefinition.maxAttachments;
	}

	//==============================================================================
	// 현재 부착물 수 반환. (코어 제외)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	countAttachments() {
		const grid = this.getGrid();
		let count = 0;
		for (let column = 0; column < GRID_COLUMNS; ++column) {
			for (let row = 0; row < GRID_ROWS; ++row) {
				if (grid[column][row] !== EMPTY_CELL) {
					++count;
				}
			}
		}
		return count - 1;
	}

	//==============================================================================
	// 우주선 합산 스탯 계산.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	calculateShipStats() {
		const grid = this.getGrid();
		return calculateStatsForGrid(grid);
	}

	//==============================================================================
	// 모듈 구매. (골드가 충분할 때 인벤토리 증가)
	//==============================================================================
	/**
	 * @param { number } partIndex
	 */
	buyModule(partIndex) {
		const partDefinition = PartDefinitions[partIndex];
		const price = partDefinition.price;
		const playerGold = this.getPlayerGold();
		if (playerGold < price) {
			return;
		}
		this.#playerGold = playerGold - price;
		this.#inventory[partIndex] += 1;
	}

	//==============================================================================
	// 대상 칸이 다른 부품과 인접하는지 여부 반환.
	//==============================================================================
	/**
	 * @param { number } column
	 * @param { number } row
	 * @returns { boolean }
	 */
	isAdjacentToPart(column, row) {
		const grid = this.getGrid();
		return isAdjacentInGrid(grid, column, row);
	}

	//==============================================================================
	// 모든 부품이 코어와 연결되어 있는지 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isAllConnected() {
		const grid = this.getGrid();
		return isAllConnectedInGrid(grid);
	}

	//==============================================================================
	// 빌드 화면 레이아웃 계산.
	// 외부 하드코딩 위치 대신 현재 뷰 크기를 읽어 런타임에 배치를 계산한다.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @returns { object }
	 */
	getBuildLayout(viewSize) {
		// 그리드는 인벤토리 공간 확보를 위해 폭을 줄여 상단에 배치.
		const gridAreaWidth = viewSize.x * 0.72;
		const cellSize = System.Math.floor(gridAreaWidth / GRID_COLUMNS);
		const gridWidth = cellSize * GRID_COLUMNS;
		const gridOriginX = System.Math.floor((viewSize.x - gridWidth) * 0.5);
		const gridOriginY = System.Math.floor(viewSize.y * 0.165);

		// 하단 세로 스크롤 인벤토리 영역.
		const inventoryAreaTop = System.Math.floor(viewSize.y * 0.585);
		const navBarHeight = System.Math.floor(viewSize.y * 0.09);
		const inventoryAreaBottom = viewSize.y - navBarHeight;
		const slotMarginX = System.Math.floor(viewSize.x * 0.06);
		const slotAreaWidth = viewSize.x - slotMarginX * 2;
		const slotGapX = System.Math.floor(viewSize.x * 0.02);
		const slotWidth = System.Math.floor((slotAreaWidth - slotGapX * (INVENTORY_COLUMNS - 1)) / INVENTORY_COLUMNS);
		const slotHeight = System.Math.floor(viewSize.y * 0.075);
		const slotGap = System.Math.floor(viewSize.y * 0.012);

		// 보유 수량만큼 모듈을 개별 슬롯으로 펼친다. (스택 없음, 2열, 스크롤 오프셋 반영)
		const scrollOffset = this.#inventoryScrollOffset;
		const inventorySlots = [];
		let slotIndex = 0;
		for (const partIndex of ATTACHMENT_PART_INDICES) {
			const inventoryCount = this.getInventoryCount(partIndex);
			for (let copy = 0; copy < inventoryCount; ++copy) {
				const columnIndex = slotIndex % INVENTORY_COLUMNS;
				const rowIndex = System.Math.floor(slotIndex / INVENTORY_COLUMNS);
				const slotX = slotMarginX + columnIndex * (slotWidth + slotGapX);
				const slotY = inventoryAreaTop + scrollOffset + rowIndex * (slotHeight + slotGap);
				inventorySlots.push({
					partIndex: partIndex,
					x: slotX,
					y: slotY,
					width: slotWidth,
					height: slotHeight,
				});
				++slotIndex;
			}
		}

		return {
			cellSize: cellSize,
			gridOriginX: gridOriginX,
			gridOriginY: gridOriginY,
			inventoryAreaTop: inventoryAreaTop,
			inventoryAreaBottom: inventoryAreaBottom,
			slotMarginX: slotMarginX,
			slotHeight: slotHeight,
			slotGap: slotGap,
			inventorySlots: inventorySlots,
		};
	}

	//==============================================================================
	// 뷰 위치에 해당하는 그리드 칸 반환.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @param { object } layout
	 * @returns { object }
	 */
	getGridCellAt(viewPosition, layout) {
		const cellSize = layout.cellSize;
		const gridOriginX = layout.gridOriginX;
		const gridOriginY = layout.gridOriginY;
		const column = System.Math.floor((viewPosition.x - gridOriginX) / cellSize);
		const row = System.Math.floor((viewPosition.y - gridOriginY) / cellSize);

		if (column >= 0 && column < GRID_COLUMNS && row >= 0 && row < GRID_ROWS) {
			return {
				column: column,
				row: row,
			};
		}
		return null;
	}

	//==============================================================================
	// 뷰 위치에 해당하는 인벤토리 슬롯 부품 인덱스 반환.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @param { object } layout
	 * @returns { number }
	 */
	getInventorySlotAt(viewPosition, layout) {
		const inventorySlots = layout.inventorySlots;
		for (const inventorySlot of inventorySlots) {
			const isInside = viewPosition.x >= inventorySlot.x &&
				viewPosition.x <= inventorySlot.x + inventorySlot.width &&
				viewPosition.y >= inventorySlot.y &&
				viewPosition.y <= inventorySlot.y + inventorySlot.height;
			if (isInside) {
				return inventorySlot.partIndex;
			}
		}
		return NO_SELECTION;
	}

	//==============================================================================
	// 상점 레이아웃 계산.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @returns { object }
	 */
	getShopLayout(viewSize) {
		const itemOriginX = System.Math.floor(viewSize.x * 0.06);
		const itemWidth = System.Math.floor(viewSize.x * 0.88);
		const itemOriginY = System.Math.floor(viewSize.y * 0.16);
		const itemHeight = System.Math.floor(viewSize.y * 0.13);
		const itemGap = System.Math.floor(viewSize.y * 0.02);

		const items = [];
		for (let index = 0; index < ATTACHMENT_PART_INDICES.length; ++index) {
			const partIndex = ATTACHMENT_PART_INDICES[index];
			items.push({
				partIndex: partIndex,
				x: itemOriginX,
				y: itemOriginY + index * (itemHeight + itemGap),
				width: itemWidth,
				height: itemHeight,
			});
		}

		return {
			items: items,
		};
	}

	//==============================================================================
	// 뷰 위치에 해당하는 상점 항목 부품 인덱스 반환.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @param { object } shopLayout
	 * @returns { number }
	 */
	getShopItemPartIndexAt(viewPosition, shopLayout) {
		const items = shopLayout.items;
		for (const item of items) {
			const isInside = viewPosition.x >= item.x &&
				viewPosition.x <= item.x + item.width &&
				viewPosition.y >= item.y &&
				viewPosition.y <= item.y + item.height;
			if (isInside) {
				return item.partIndex;
			}
		}
		return NO_SELECTION;
	}

	//==============================================================================
	// 하단 네비게이션 레이아웃 계산.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @returns { object }
	 */
	getNavigationLayout(viewSize) {
		const barHeight = System.Math.floor(viewSize.y * 0.09);
		const barY = viewSize.y - barHeight;

		const tabInfos = [
			{
				tab: AppTab.build,
				label: "조립",
			},
			{
				tab: AppTab.shop,
				label: "상점",
			},
			{
				tab: AppTab.battle,
				label: "싸우기",
			},
			{
				tab: AppTab.settings,
				label: "설정",
			},
		];

		const buttonWidth = viewSize.x / tabInfos.length;
		const buttons = [];
		for (let index = 0; index < tabInfos.length; ++index) {
			const tabInfo = tabInfos[index];
			buttons.push({
				tab: tabInfo.tab,
				label: tabInfo.label,
				x: System.Math.floor(buttonWidth * index),
				y: barY,
				width: System.Math.floor(buttonWidth),
				height: barHeight,
			});
		}

		return {
			barY: barY,
			barHeight: barHeight,
			buttons: buttons,
		};
	}

	//==============================================================================
	// 뷰 위치에 해당하는 네비게이션 탭 반환.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @param { object } navigationLayout
	 * @returns { number }
	 */
	getNavigationTabAt(viewPosition, navigationLayout) {
		const buttons = navigationLayout.buttons;
		for (const button of buttons) {
			const isInside = viewPosition.x >= button.x &&
				viewPosition.x <= button.x + button.width &&
				viewPosition.y >= button.y &&
				viewPosition.y <= button.y + button.height;
			if (isInside) {
				return button.tab;
			}
		}
		return NO_SELECTION;
	}

	//==============================================================================
	// 전투 탭 적 목록 레이아웃 계산.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @returns { object }
	 */
	getBattleLayout(viewSize) {
		const listOriginX = System.Math.floor(viewSize.x * 0.06);
		const listWidth = System.Math.floor(viewSize.x * 0.88);
		const listOriginY = System.Math.floor(viewSize.y * 0.15);
		const itemHeight = System.Math.floor(viewSize.y * 0.13);
		const itemGap = System.Math.floor(viewSize.y * 0.013);

		const buttonWidth = System.Math.floor(listWidth * 0.22);
		const buttonHeight = System.Math.floor(itemHeight * 0.5);
		const buttonPadding = System.Math.floor(listWidth * 0.02);

		const scrollOffset = this.#battleScrollOffset;
		const enemyList = this.getEnemyList();
		const items = [];
		for (let index = 0; index < enemyList.length; ++index) {
			const itemY = listOriginY + scrollOffset + index * (itemHeight + itemGap);
			items.push({
				index: index,
				x: listOriginX,
				y: itemY,
				width: listWidth,
				height: itemHeight,
				button: {
					x: listOriginX + listWidth - buttonWidth - buttonPadding,
					y: itemY + System.Math.floor((itemHeight - buttonHeight) * 0.5),
					width: buttonWidth,
					height: buttonHeight,
				},
			});
		}

		return {
			items: items,
		};
	}

	//==============================================================================
	// 뷰 위치에 해당하는 적 목록 인덱스 반환.
	//==============================================================================
	/**
	 * @param { Vector2 } viewPosition
	 * @param { object } battleLayout
	 * @returns { number }
	 */
	getBattleItemAt(viewPosition, battleLayout) {
		const items = battleLayout.items;
		for (const item of items) {
			const isInside = viewPosition.x >= item.x &&
				viewPosition.x <= item.x + item.width &&
				viewPosition.y >= item.y &&
				viewPosition.y <= item.y + item.height;
			if (isInside) {
				return item.index;
			}
		}
		return NO_SELECTION;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @protected
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);

		const engine = this.getEngine();
		const inputManager = engine.getInputManager();
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();

		// 전투 진행 중에는 전투만 갱신한다. (탭/네비 입력 차단)
		if (this.#battleState) {
			this.updateBattle(timeDelta, viewSize);
			if (inputManager.isTouchPressed()) {
				const battleInputPosition = inputManager.getViewInputPosition();
				this.handleBattleInput(battleInputPosition, viewSize);
			}
			return;
		}

		const isPressed = inputManager.isTouchPressed();
		const viewInputPosition = inputManager.getViewInputPosition();
		const currentTab = this.getCurrentTab();

		// 네비게이션 탭 전환은 누른 순간 최우선 처리.
		if (isPressed) {
			const navigationLayout = this.getNavigationLayout(viewSize);
			const navigationTab = this.getNavigationTabAt(viewInputPosition, navigationLayout);
			if (navigationTab !== NO_SELECTION) {
				this.#draggingPartIndex = NO_SELECTION;
				this.#currentTab = navigationTab;
				return;
			}
		}

		// 현재 탭 콘텐츠 입력 처리.
		switch (currentTab) {
			case AppTab.build: {
					this.tickBuildTab(viewSize, inputManager);
					break;
				}

			case AppTab.shop: {
					if (isPressed) {
						this.tickShopTab(viewSize, viewInputPosition);
					}
					break;
				}

			case AppTab.battle: {
					this.tickBattleTab(viewSize, inputManager);
					break;
				}

			case AppTab.settings: {
					break;
				}
		}
	}

	//==============================================================================
	// 조립 탭 입력 처리.
	// 인벤토리 슬롯을 드래그해 그리드 빈 칸에 드롭하면 배치, 그리드 부품을 누르면 제거.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @param { object } inputManager
	 */
	tickBuildTab(viewSize, inputManager) {
		const layout = this.getBuildLayout(viewSize);
		const viewInputPosition = inputManager.getViewInputPosition();

		// 누름.
		if (inputManager.isTouchPressed()) {
			const isInsideInventory = viewInputPosition.y >= layout.inventoryAreaTop &&
				viewInputPosition.y <= layout.inventoryAreaBottom;
			if (isInsideInventory) {
				// 인벤토리 영역: 슬롯이면 드래그 후보, 빈 곳이면 스크롤 대기.
				const slotPartIndex = this.getInventorySlotAt(viewInputPosition, layout);
				this.#dragCandidatePartIndex = slotPartIndex;
				this.#inventoryScrollStartY = viewInputPosition.y;
				this.#inventoryScrollStartOffset = this.#inventoryScrollOffset;
				this.#inventoryDragMode = DRAG_MODE_PENDING;
				return;
			}

			// 그리드 영역: 부품 제거.
			const gridCell = this.getGridCellAt(viewInputPosition, layout);
			if (gridCell) {
				this.removePartFromCell(gridCell.column, gridCell.row);
			}
			return;
		}

		// 이동: 부착(그리드 영역으로 끌어올림) 또는 스크롤(영역 내 위아래) 결정 및 처리.
		if (inputManager.isTouchMoved()) {
			const isAboveInventory = viewInputPosition.y < layout.inventoryAreaTop;
			const hasCandidate = this.#dragCandidatePartIndex !== NO_SELECTION;

			// 그리드 영역으로 끌어올리면(후보가 있으면) 스크롤 중이라도 부착으로 전환한다.
			if (hasCandidate && isAboveInventory && this.#inventoryDragMode !== DRAG_MODE_ATTACH) {
				this.#inventoryDragMode = DRAG_MODE_ATTACH;
				this.#draggingPartIndex = this.#dragCandidatePartIndex;
			}
			// 영역 안에서 충분히 움직이면 스크롤로 확정한다.
			else if (this.#inventoryDragMode === DRAG_MODE_PENDING) {
				const dragDelta = viewInputPosition.y - this.#inventoryScrollStartY;
				if (System.Math.abs(dragDelta) > SCROLL_DRAG_THRESHOLD) {
					this.#inventoryDragMode = DRAG_MODE_SCROLL;
				}
			}

			if (this.#inventoryDragMode === DRAG_MODE_ATTACH) {
				this.#dragPosition = viewInputPosition.clone();
			}
			else if (this.#inventoryDragMode === DRAG_MODE_SCROLL) {
				const dragDelta = viewInputPosition.y - this.#inventoryScrollStartY;
				const nextOffset = this.#inventoryScrollStartOffset + dragDelta;
				this.#inventoryScrollOffset = this.clampInventoryScroll(nextOffset, viewSize);
			}
			return;
		}

		// 뗌: 부착 모드면 그리드에 드롭.
		if (inputManager.isTouchReleased()) {
			if (this.#inventoryDragMode === DRAG_MODE_ATTACH && this.#draggingPartIndex !== NO_SELECTION) {
				const gridCell = this.getGridCellAt(viewInputPosition, layout);
				if (gridCell) {
					this.placePartAtCell(gridCell.column, gridCell.row, this.#draggingPartIndex);
				}
			}
			this.#inventoryDragMode = DRAG_MODE_NONE;
			this.#draggingPartIndex = NO_SELECTION;
			this.#dragCandidatePartIndex = NO_SELECTION;
		}
	}

	//==============================================================================
	// 인벤토리 스크롤 오프셋 제한.
	//==============================================================================
	/**
	 * @param { number } offset
	 * @param { Vector2 } viewSize
	 * @returns { number }
	 */
	clampInventoryScroll(offset, viewSize) {
		const layout = this.getBuildLayout(viewSize);
		const slotCount = layout.inventorySlots.length;
		const rowCount = System.Math.ceil(slotCount / INVENTORY_COLUMNS);
		const contentHeight = rowCount * (layout.slotHeight + layout.slotGap);
		const viewAreaHeight = layout.inventoryAreaBottom - layout.inventoryAreaTop;

		let minOffset = viewAreaHeight - contentHeight;
		if (minOffset > 0) {
			minOffset = 0;
		}
		let clampedOffset = offset;
		if (clampedOffset > 0) {
			clampedOffset = 0;
		}
		if (clampedOffset < minOffset) {
			clampedOffset = minOffset;
		}
		return clampedOffset;
	}

	//==============================================================================
	// 상점 탭 입력 처리.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @param { Vector2 } viewInputPosition
	 */
	tickShopTab(viewSize, viewInputPosition) {
		const shopLayout = this.getShopLayout(viewSize);
		const partIndex = this.getShopItemPartIndexAt(viewInputPosition, shopLayout);
		if (partIndex !== NO_SELECTION) {
			this.buyModule(partIndex);
		}
	}

	//==============================================================================
	// 전투 탭 입력 처리. (드래그는 스크롤, 짧은 탭은 선택/전투)
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @param { object } inputManager
	 */
	tickBattleTab(viewSize, inputManager) {
		const viewInputPosition = inputManager.getViewInputPosition();

		if (inputManager.isTouchPressed()) {
			this.#battleScrollDragStartY = viewInputPosition.y;
			this.#battleScrollStartOffset = this.#battleScrollOffset;
			this.#battleIsScrolling = false;
			return;
		}

		if (inputManager.isTouchMoved()) {
			const dragDelta = viewInputPosition.y - this.#battleScrollDragStartY;
			if (System.Math.abs(dragDelta) > SCROLL_DRAG_THRESHOLD) {
				this.#battleIsScrolling = true;
			}
			if (this.#battleIsScrolling) {
				const nextOffset = this.#battleScrollStartOffset + dragDelta;
				this.#battleScrollOffset = this.clampBattleScroll(nextOffset, viewSize);
			}
			return;
		}

		if (inputManager.isTouchReleased()) {
			if (!this.#battleIsScrolling) {
				this.handleBattleTap(viewSize, viewInputPosition);
			}
			this.#battleIsScrolling = false;
		}
	}

	//==============================================================================
	// 전투 탭 탭(선택/전투 버튼) 처리.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @param { Vector2 } viewInputPosition
	 */
	handleBattleTap(viewSize, viewInputPosition) {
		const battleLayout = this.getBattleLayout(viewSize);
		const items = battleLayout.items;

		// "전투" 버튼 우선 처리.
		for (const item of items) {
			const button = item.button;
			const isInsideButton = viewInputPosition.x >= button.x &&
				viewInputPosition.x <= button.x + button.width &&
				viewInputPosition.y >= button.y &&
				viewInputPosition.y <= button.y + button.height;
			if (isInsideButton) {
				this.startBattle(item.index, viewSize);
				return;
			}
		}

		// 항목 선택.
		const itemIndex = this.getBattleItemAt(viewInputPosition, battleLayout);
		if (itemIndex !== NO_SELECTION) {
			this.#selectedEnemyIndex = itemIndex;
		}
	}

	//==============================================================================
	// 전투 목록 스크롤 오프셋 제한.
	//==============================================================================
	/**
	 * @param { number } offset
	 * @param { Vector2 } viewSize
	 * @returns { number }
	 */
	clampBattleScroll(offset, viewSize) {
		const enemyList = this.getEnemyList();
		const itemHeight = System.Math.floor(viewSize.y * 0.13);
		const itemGap = System.Math.floor(viewSize.y * 0.013);
		const listOriginY = System.Math.floor(viewSize.y * 0.15);
		const navBarHeight = System.Math.floor(viewSize.y * 0.09);
		const navBarY = viewSize.y - navBarHeight;
		const contentHeight = enemyList.length * (itemHeight + itemGap);
		const viewAreaHeight = navBarY - listOriginY;

		let minOffset = viewAreaHeight - contentHeight;
		if (minOffset > 0) {
			minOffset = 0;
		}
		let clampedOffset = offset;
		if (clampedOffset > 0) {
			clampedOffset = 0;
		}
		if (clampedOffset < minOffset) {
			clampedOffset = minOffset;
		}
		return clampedOffset;
	}

	//==============================================================================
	// 그리드 칸에 부품 배치.
	// 빈 칸 + 보유 수량 > 0 + 최대 부착물 수 이하 + 기존 부품과 인접해야 한다.
	//==============================================================================
	/**
	 * @param { number } column
	 * @param { number } row
	 * @param { number } partIndex
	 */
	placePartAtCell(column, row, partIndex) {
		if (column === CORE_COLUMN && row === CORE_ROW) {
			return;
		}

		const grid = this.getGrid();
		if (grid[column][row] !== EMPTY_CELL) {
			return;
		}
		const inventoryCount = this.getInventoryCount(partIndex);
		if (inventoryCount <= 0) {
			return;
		}
		const attachmentCount = this.countAttachments();
		const maxAttachments = this.getMaxAttachments();
		if (attachmentCount >= maxAttachments) {
			return;
		}
		const isAdjacent = this.isAdjacentToPart(column, row);
		if (!isAdjacent) {
			return;
		}

		grid[column][row] = partIndex;
		this.#inventory[partIndex] -= 1;
	}

	//==============================================================================
	// 그리드 칸의 부품 제거.
	// 제거 후에도 모든 부품이 코어와 연결되어야 하며, 보유 수량으로 반환된다.
	//==============================================================================
	/**
	 * @param { number } column
	 * @param { number } row
	 */
	removePartFromCell(column, row) {
		if (column === CORE_COLUMN && row === CORE_ROW) {
			return;
		}

		const grid = this.getGrid();
		const currentPartIndex = grid[column][row];
		if (currentPartIndex === EMPTY_CELL) {
			return;
		}

		grid[column][row] = EMPTY_CELL;
		const isConnected = this.isAllConnected();
		if (!isConnected) {
			grid[column][row] = currentPartIndex;
			return;
		}
		this.#inventory[currentPartIndex] += 1;
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		super.draw(graphic);

		const engine = this.getEngine();
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const viewSize = viewManager.getViewSize();

		// 화면 바깥(레터박스) 영역.
		viewManager.applyCanvasNativeRect(canvasRenderingContext);
		canvasRenderingContext.fillStyle = "#05070f";
		canvasRenderingContext.fillRect(0, 0, canvasNativeSize.x, canvasNativeSize.y);

		// 게임 영역 배경.
		viewManager.applyViewRect(canvasRenderingContext);
		canvasRenderingContext.fillStyle = "#11162a";
		canvasRenderingContext.fillRect(0, 0, viewSize.x, viewSize.y);

		// 전투 진행 중에는 전투 화면만 출력한다. (상단 바/네비 숨김)
		if (this.#battleState) {
			this.drawBattle(canvasRenderingContext, viewSize);
			return;
		}

		// 현재 탭 콘텐츠 출력.
		const currentTab = this.getCurrentTab();
		switch (currentTab) {
			case AppTab.build: {
					this.drawBuildTab(canvasRenderingContext, viewSize);
					break;
				}

			case AppTab.shop: {
					this.drawShopTab(canvasRenderingContext, viewSize);
					break;
				}

			case AppTab.battle: {
					this.drawBattleTab(canvasRenderingContext, viewSize);
					break;
				}

			case AppTab.settings: {
					this.drawSettingsTab(canvasRenderingContext, viewSize);
					break;
				}
		}

		// 상단 바 출력. (항상 위에 표시)
		this.drawTopBar(canvasRenderingContext, viewSize);

		// 하단 네비게이션 출력. (항상 위에 표시)
		this.drawNavigationBar(canvasRenderingContext, viewSize);
	}

	//==============================================================================
	// 상단 바 출력. (내 레벨 / 골드)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawTopBar(canvasRenderingContext, viewSize) {
		const barHeight = System.Math.floor(viewSize.y * 0.055);

		// 바 배경.
		canvasRenderingContext.fillStyle = "#0a0e1a";
		canvasRenderingContext.fillRect(0, 0, viewSize.x, barHeight);

		// 바 하단 구분선.
		canvasRenderingContext.strokeStyle = "#2a3350";
		canvasRenderingContext.lineWidth = 2;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.moveTo(0, barHeight);
		canvasRenderingContext.lineTo(viewSize.x, barHeight);
		canvasRenderingContext.stroke();

		const barCenterY = barHeight * 0.5;

		// 레벨 (좌측).
		const playerLevel = this.getPlayerLevel();
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 28px sans-serif";
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText(`레벨 ${playerLevel}`, viewSize.x * 0.05, barCenterY);

		// 골드 (우측).
		const playerGold = this.getPlayerGold();
		canvasRenderingContext.fillStyle = "#ffd24a";
		canvasRenderingContext.textAlign = "right";
		canvasRenderingContext.fillText(`골드 ${playerGold}`, viewSize.x * 0.95, barCenterY);
	}

	//==============================================================================
	// 빌드 탭 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawBuildTab(canvasRenderingContext, viewSize) {
		const layout = this.getBuildLayout(viewSize);
		this.drawBuildHeader(canvasRenderingContext, viewSize);
		this.drawGrid(canvasRenderingContext, layout);
		this.drawInventory(canvasRenderingContext, layout, viewSize);

		// 드래그 중인 부품 미리보기.
		const draggingPartIndex = this.getDraggingPartIndex();
		if (draggingPartIndex !== NO_SELECTION) {
			const dragPosition = this.getDragPosition();
			const cellSize = layout.cellSize;
			canvasRenderingContext.globalAlpha = 0.7;
			this.drawPart(canvasRenderingContext, draggingPartIndex, dragPosition.x - cellSize * 0.5, dragPosition.y - cellSize * 0.5, cellSize);
			canvasRenderingContext.globalAlpha = 1.0;
		}
	}

	//==============================================================================
	// 빌드 탭 상단 제목 및 스탯 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawBuildHeader(canvasRenderingContext, viewSize) {
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 44px sans-serif";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "top";
		canvasRenderingContext.fillText("우주선 조립", viewSize.x * 0.5, viewSize.y * 0.065);

		const shipStats = this.calculateShipStats();
		const statsText = `체력 ${shipStats.health}   공격력 ${shipStats.attack}   속도 ${shipStats.speed}`;
		canvasRenderingContext.fillStyle = "#aab4d4";
		canvasRenderingContext.font = "26px sans-serif";
		canvasRenderingContext.fillText(statsText, viewSize.x * 0.5, viewSize.y * 0.105);

		const attachmentCount = this.countAttachments();
		const maxAttachments = this.getMaxAttachments();
		const attachmentText = `부착물 ${attachmentCount} / ${maxAttachments}`;
		let attachmentColor = "#7fd6a0";
		if (attachmentCount >= maxAttachments) {
			attachmentColor = "#ff9a9a";
		}
		canvasRenderingContext.fillStyle = attachmentColor;
		canvasRenderingContext.font = "bold 26px sans-serif";
		canvasRenderingContext.fillText(attachmentText, viewSize.x * 0.5, viewSize.y * 0.135);
	}

	//==============================================================================
	// 그리드 및 배치된 부품 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { object } layout
	 */
	drawGrid(canvasRenderingContext, layout) {
		const cellSize = layout.cellSize;
		const gridOriginX = layout.gridOriginX;
		const gridOriginY = layout.gridOriginY;
		const grid = this.getGrid();

		for (let column = 0; column < GRID_COLUMNS; ++column) {
			for (let row = 0; row < GRID_ROWS; ++row) {
				const cellX = gridOriginX + column * cellSize;
				const cellY = gridOriginY + row * cellSize;

				// 빈 칸은 배치 가능 위치를 흐리게만 표시한다.
				const partIndex = grid[column][row];
				if (partIndex === EMPTY_CELL) {
					canvasRenderingContext.strokeStyle = "rgba(140, 160, 220, 0.15)";
					canvasRenderingContext.lineWidth = 1;
					canvasRenderingContext.strokeRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1);
					continue;
				}

				// 배치된 부품 박스는 칸을 꽉 채워 인접 부품과 맞붙는다.
				this.drawPart(canvasRenderingContext, partIndex, cellX, cellY, cellSize);
			}
		}
	}

	//==============================================================================
	// 단일 부품 출력. (모서리를 깎은 팔각형 + 중앙 원 + 식별 문자)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { number } partIndex
	 * @param { number } cellX
	 * @param { number } cellY
	 * @param { number } cellSize
	 */
	drawPart(canvasRenderingContext, partIndex, cellX, cellY, cellSize) {
		const partDefinition = PartDefinitions[partIndex];
		const centerX = cellX + cellSize * 0.5;
		const centerY = cellY + cellSize * 0.5;
		const cornerCut = cellSize * 0.22;

		// 모서리를 깎은 팔각형 본체.
		canvasRenderingContext.fillStyle = partDefinition.color;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.moveTo(cellX + cornerCut, cellY);
		canvasRenderingContext.lineTo(cellX + cellSize - cornerCut, cellY);
		canvasRenderingContext.lineTo(cellX + cellSize, cellY + cornerCut);
		canvasRenderingContext.lineTo(cellX + cellSize, cellY + cellSize - cornerCut);
		canvasRenderingContext.lineTo(cellX + cellSize - cornerCut, cellY + cellSize);
		canvasRenderingContext.lineTo(cellX + cornerCut, cellY + cellSize);
		canvasRenderingContext.lineTo(cellX, cellY + cellSize - cornerCut);
		canvasRenderingContext.lineTo(cellX, cellY + cornerCut);
		canvasRenderingContext.closePath();
		canvasRenderingContext.fill();

		// 중앙 원.
		const circleRadius = cellSize * 0.26;
		canvasRenderingContext.fillStyle = "rgba(12, 18, 30, 0.85)";
		canvasRenderingContext.beginPath();
		canvasRenderingContext.arc(centerX, centerY, circleRadius, 0, System.Math.PI * 2);
		canvasRenderingContext.closePath();
		canvasRenderingContext.fill();

		// 원 안 식별 문자.
		const fontSize = System.Math.max(16, System.Math.floor(cellSize * 0.30));
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = `bold ${fontSize}px sans-serif`;
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText(partDefinition.symbol, centerX, centerY);
	}

	//==============================================================================
	// 우주선 그리드 썸네일 출력. (작은 색 박스 모음)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Array<Array<number>> } grid
	 * @param { number } originX
	 * @param { number } originY
	 * @param { number } totalSize
	 */
	drawShipThumbnail(canvasRenderingContext, grid, originX, originY, totalSize) {
		const thumbnailCellSize = totalSize / GRID_COLUMNS;
		for (let column = 0; column < GRID_COLUMNS; ++column) {
			for (let row = 0; row < GRID_ROWS; ++row) {
				const partIndex = grid[column][row];
				if (partIndex === EMPTY_CELL) {
					continue;
				}
				const partDefinition = PartDefinitions[partIndex];
				const boxX = originX + column * thumbnailCellSize;
				const boxY = originY + row * thumbnailCellSize;
				canvasRenderingContext.fillStyle = partDefinition.color;
				canvasRenderingContext.fillRect(boxX, boxY, thumbnailCellSize - 1, thumbnailCellSize - 1);
			}
		}
	}

	//==============================================================================
	// 하단 세로 스크롤 인벤토리 출력. (모듈을 개별 슬롯으로 나열, 드래그 소스)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { object } layout
	 * @param { Vector2 } viewSize
	 */
	drawInventory(canvasRenderingContext, layout, viewSize) {
		// 영역 라벨. (클리핑 밖, 영역 위)
		const labelOffsetY = System.Math.floor(viewSize.y * 0.008);
		canvasRenderingContext.fillStyle = "#cfd6ea";
		canvasRenderingContext.font = "bold 24px sans-serif";
		canvasRenderingContext.textAlign = "left";
		canvasRenderingContext.textBaseline = "bottom";
		canvasRenderingContext.fillText("인벤토리 (위로 끌어 부착)", layout.slotMarginX, layout.inventoryAreaTop - labelOffsetY);

		// 스크롤 영역 클리핑.
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(0, layout.inventoryAreaTop, viewSize.x, layout.inventoryAreaBottom - layout.inventoryAreaTop);
		canvasRenderingContext.clip();

		const inventorySlots = layout.inventorySlots;
		for (const inventorySlot of inventorySlots) {
			const partIndex = inventorySlot.partIndex;
			const partDefinition = PartDefinitions[partIndex];

			// 슬롯 배경.
			canvasRenderingContext.fillStyle = "#1b2238";
			canvasRenderingContext.fillRect(inventorySlot.x, inventorySlot.y, inventorySlot.width, inventorySlot.height);

			// 좌측 모듈 색 아이콘.
			const iconSize = inventorySlot.height * 0.64;
			const iconX = inventorySlot.x + inventorySlot.height * 0.18;
			const iconY = inventorySlot.y + inventorySlot.height * 0.18;
			canvasRenderingContext.fillStyle = partDefinition.color;
			canvasRenderingContext.fillRect(iconX, iconY, iconSize, iconSize);

			// 모듈 이름.
			const textX = iconX + iconSize + inventorySlot.width * 0.03;
			canvasRenderingContext.fillStyle = "#ffffff";
			canvasRenderingContext.font = "bold 28px sans-serif";
			canvasRenderingContext.textAlign = "left";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(partDefinition.name, textX, inventorySlot.y + inventorySlot.height * 0.5);
		}

		canvasRenderingContext.restore();

		// 빈 인벤토리 안내.
		if (inventorySlots.length === 0) {
			const centerY = (layout.inventoryAreaTop + layout.inventoryAreaBottom) * 0.5;
			canvasRenderingContext.fillStyle = "#7a85a8";
			canvasRenderingContext.font = "24px sans-serif";
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText("보유한 모듈이 없습니다. 상점에서 구매하세요.", viewSize.x * 0.5, centerY);
		}
	}

	//==============================================================================
	// 상점 탭 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawShopTab(canvasRenderingContext, viewSize) {
		// 제목.
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 44px sans-serif";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "top";
		canvasRenderingContext.fillText("상점", viewSize.x * 0.5, viewSize.y * 0.08);

		const shopLayout = this.getShopLayout(viewSize);
		const items = shopLayout.items;

		for (const item of items) {
			const partIndex = item.partIndex;
			const partDefinition = PartDefinitions[partIndex];
			const inventoryCount = this.getInventoryCount(partIndex);

			// 항목 배경.
			canvasRenderingContext.fillStyle = "#1b2238";
			canvasRenderingContext.fillRect(item.x, item.y, item.width, item.height);

			// 좌측 모듈 색 박스.
			const colorBoxSize = item.height * 0.6;
			const colorBoxX = item.x + item.height * 0.2;
			const colorBoxY = item.y + item.height * 0.2;
			canvasRenderingContext.fillStyle = partDefinition.color;
			canvasRenderingContext.fillRect(colorBoxX, colorBoxY, colorBoxSize, colorBoxSize);

			// 모듈 이름.
			const textX = colorBoxX + colorBoxSize + item.width * 0.04;
			canvasRenderingContext.fillStyle = "#ffffff";
			canvasRenderingContext.font = "bold 30px sans-serif";
			canvasRenderingContext.textAlign = "left";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(partDefinition.name, textX, item.y + item.height * 0.34);

			// 보유 수량.
			canvasRenderingContext.fillStyle = "#aab4d4";
			canvasRenderingContext.font = "24px sans-serif";
			canvasRenderingContext.fillText(`보유 ${inventoryCount}`, textX, item.y + item.height * 0.68);

			// 우측 가격 + 구매 안내.
			canvasRenderingContext.fillStyle = "#ffd24a";
			canvasRenderingContext.font = "bold 30px sans-serif";
			canvasRenderingContext.textAlign = "right";
			canvasRenderingContext.fillText(`${partDefinition.price} 골드`, item.x + item.width - item.width * 0.04, item.y + item.height * 0.34);

			canvasRenderingContext.fillStyle = "#7fd6a0";
			canvasRenderingContext.font = "22px sans-serif";
			canvasRenderingContext.fillText("탭하여 구매", item.x + item.width - item.width * 0.04, item.y + item.height * 0.68);
		}
	}

	//==============================================================================
	// 전투 탭 출력. (무작위 적 목록 + 썸네일)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawBattleTab(canvasRenderingContext, viewSize) {
		// 제목.
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 44px sans-serif";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "top";
		canvasRenderingContext.fillText("싸울 상대 선택", viewSize.x * 0.5, viewSize.y * 0.08);

		// 스크롤 영역 클리핑. (목록만 잘라 그린다, 제목/네비는 영향 없음)
		const navBarHeight = System.Math.floor(viewSize.y * 0.09);
		const clipTop = System.Math.floor(viewSize.y * 0.14);
		const clipBottom = viewSize.y - navBarHeight;
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(0, clipTop, viewSize.x, clipBottom - clipTop);
		canvasRenderingContext.clip();

		const battleLayout = this.getBattleLayout(viewSize);
		const enemyList = this.getEnemyList();
		const selectedEnemyIndex = this.getSelectedEnemyIndex();
		const items = battleLayout.items;

		for (const item of items) {
			const enemy = enemyList[item.index];
			const isSelected = item.index === selectedEnemyIndex;

			// 항목 배경.
			let backgroundColor = "#1b2238";
			if (isSelected) {
				backgroundColor = "#2c3a66";
			}
			canvasRenderingContext.fillStyle = backgroundColor;
			canvasRenderingContext.fillRect(item.x, item.y, item.width, item.height);

			// 선택 표시 외곽선.
			if (isSelected) {
				canvasRenderingContext.strokeStyle = "#ffffff";
				canvasRenderingContext.lineWidth = 3;
				canvasRenderingContext.strokeRect(item.x + 2, item.y + 2, item.width - 4, item.height - 4);
			}

			// 좌측 우주선 썸네일.
			const thumbnailSize = item.height * 0.78;
			const thumbnailX = item.x + item.height * 0.11;
			const thumbnailY = item.y + item.height * 0.11;
			this.drawShipThumbnail(canvasRenderingContext, enemy.grid, thumbnailX, thumbnailY, thumbnailSize);

			// 적 이름.
			const textX = thumbnailX + thumbnailSize + item.width * 0.04;
			canvasRenderingContext.fillStyle = "#ffffff";
			canvasRenderingContext.font = "bold 30px sans-serif";
			canvasRenderingContext.textAlign = "left";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(enemy.name, textX, item.y + item.height * 0.34);

			// 적 스탯.
			const enemyStatsText = `체력 ${enemy.stats.health}   공격 ${enemy.stats.attack}   속도 ${enemy.stats.speed}`;
			canvasRenderingContext.fillStyle = "#aab4d4";
			canvasRenderingContext.font = "22px sans-serif";
			canvasRenderingContext.fillText(enemyStatsText, textX, item.y + item.height * 0.68);

			// "전투" 버튼.
			const button = item.button;
			canvasRenderingContext.fillStyle = "#d24a4a";
			canvasRenderingContext.fillRect(button.x, button.y, button.width, button.height);
			canvasRenderingContext.fillStyle = "#ffffff";
			canvasRenderingContext.font = "bold 28px sans-serif";
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText("싸우기", button.x + button.width * 0.5, button.y + button.height * 0.5);
		}

		canvasRenderingContext.restore();
	}

	//==============================================================================
	// 설정 탭 출력. (추후 정의)
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawSettingsTab(canvasRenderingContext, viewSize) {
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "bold 44px sans-serif";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "top";
		canvasRenderingContext.fillText("설정", viewSize.x * 0.5, viewSize.y * 0.08);

		canvasRenderingContext.fillStyle = "#7a85a8";
		canvasRenderingContext.font = "28px sans-serif";
		canvasRenderingContext.textBaseline = "middle";
		canvasRenderingContext.fillText("준비 중입니다.", viewSize.x * 0.5, viewSize.y * 0.45);
	}

	//==============================================================================
	// 하단 네비게이션 바 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawNavigationBar(canvasRenderingContext, viewSize) {
		const navigationLayout = this.getNavigationLayout(viewSize);
		const currentTab = this.getCurrentTab();

		// 바 배경.
		canvasRenderingContext.fillStyle = "#0a0e1a";
		canvasRenderingContext.fillRect(0, navigationLayout.barY, viewSize.x, navigationLayout.barHeight);

		// 바 상단 구분선.
		canvasRenderingContext.strokeStyle = "#2a3350";
		canvasRenderingContext.lineWidth = 2;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.moveTo(0, navigationLayout.barY);
		canvasRenderingContext.lineTo(viewSize.x, navigationLayout.barY);
		canvasRenderingContext.stroke();

		const buttons = navigationLayout.buttons;
		for (const button of buttons) {
			const isActive = button.tab === currentTab;

			// 활성 탭 배경.
			if (isActive) {
				canvasRenderingContext.fillStyle = "#1a2240";
				canvasRenderingContext.fillRect(button.x, button.y, button.width, button.height);
			}

			// 탭 이름.
			let labelColor = "#7a85a8";
			if (isActive) {
				labelColor = "#ffffff";
			}
			const buttonCenterX = button.x + button.width * 0.5;
			const buttonCenterY = button.y + button.height * 0.5;
			canvasRenderingContext.fillStyle = labelColor;
			canvasRenderingContext.font = "bold 28px sans-serif";
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(button.label, buttonCenterX, buttonCenterY);
		}
	}

	//==============================================================================
	// 전투 화면 배치 계산.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @returns { object }
	 */
	getBattleArena(viewSize) {
		const cellSize = System.Math.floor(viewSize.x * 0.085);
		const shipHalf = cellSize * 2.5;
		const mapLeft = System.Math.floor(viewSize.x * 0.06);
		const mapRight = viewSize.x - mapLeft;
		const mapTop = System.Math.floor(viewSize.y * 0.105);
		const mapBottom = System.Math.floor(viewSize.y * 0.82);
		const centerX = viewSize.x * 0.5;
		const startMargin = System.Math.floor(viewSize.y * 0.02);
		const enemyStartY = mapTop + shipHalf + startMargin;
		const playerStartY = mapBottom - shipHalf - startMargin;
		const amplitude = (mapRight - mapLeft) * 0.28;
		return {
			cellSize: cellSize,
			shipHalf: shipHalf,
			mapLeft: mapLeft,
			mapRight: mapRight,
			mapTop: mapTop,
			mapBottom: mapBottom,
			centerX: centerX,
			enemyStartY: enemyStartY,
			playerStartY: playerStartY,
			amplitude: amplitude,
		};
	}

	//==============================================================================
	// 전투 화면 조작 버튼 배치 계산.
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @returns { object }
	 */
	getBattleControlLayout(viewSize) {
		const exitButton = {
			x: System.Math.floor(viewSize.x * 0.72),
			y: System.Math.floor(viewSize.y * 0.03),
			width: System.Math.floor(viewSize.x * 0.24),
			height: System.Math.floor(viewSize.y * 0.05),
		};
		const confirmButton = {
			x: System.Math.floor(viewSize.x * 0.30),
			y: System.Math.floor(viewSize.y * 0.56),
			width: System.Math.floor(viewSize.x * 0.40),
			height: System.Math.floor(viewSize.y * 0.07),
		};
		return {
			exitButton: exitButton,
			confirmButton: confirmButton,
		};
	}

	//==============================================================================
	// 전투 시작. (현재 조립한 우주선 vs 선택한 적)
	//==============================================================================
	/**
	 * @param { number } enemyIndex
	 * @param { Vector2 } viewSize
	 */
	startBattle(enemyIndex, viewSize) {
		const arena = this.getBattleArena(viewSize);
		const playerGrid = this.getGrid();
		const playerStats = this.calculateShipStats();
		const enemyList = this.getEnemyList();
		const enemy = enemyList[enemyIndex];
		const playerHealth = System.Math.max(1, playerStats.health);
		const enemyHealth = System.Math.max(1, enemy.stats.health);

		this.#selectedEnemyIndex = enemyIndex;
		this.#battleState = {
			phase: BATTLE_PHASE_FIGHTING,
			elapsed: 0,
			beams: [],
			stars: this.createBattleStars(arena),
			winnerIsPlayer: false,
			player: {
				name: "내 우주선",
				grid: playerGrid,
				stats: playerStats,
				x: arena.centerX,
				y: arena.playerStartY,
				health: playerHealth,
				maxHealth: playerHealth,
				fireTimer: FIRE_PERIOD * 0.5,
				phaseOffset: 0,
				isPlayer: true,
			},
			enemy: {
				name: enemy.name,
				grid: enemy.grid,
				stats: enemy.stats,
				x: arena.centerX,
				y: arena.enemyStartY,
				health: enemyHealth,
				maxHealth: enemyHealth,
				fireTimer: FIRE_PERIOD,
				phaseOffset: System.Math.PI,
				isPlayer: false,
			},
		};
	}

	//==============================================================================
	// 전투 맵 배경 별 생성. (맵 영역 내 고정 좌표)
	//==============================================================================
	/**
	 * @param { object } arena
	 * @returns { Array<object> }
	 */
	createBattleStars(arena) {
		const stars = [];
		const starCount = 40;
		const mapWidth = arena.mapRight - arena.mapLeft;
		const mapHeight = arena.mapBottom - arena.mapTop;
		for (let index = 0; index < starCount; ++index) {
			stars.push({
				x: arena.mapLeft + System.Math.random() * mapWidth,
				y: arena.mapTop + System.Math.random() * mapHeight,
			});
		}
		return stars;
	}

	//==============================================================================
	// 우주선 이동 속도 반환. (기본 + 추진체 속도 보너스)
	//==============================================================================
	/**
	 * @param { object } ship
	 * @param { Vector2 } viewSize
	 * @returns { number }
	 */
	getShipMoveSpeed(ship, viewSize) {
		const baseSpeed = viewSize.y * 0.10;
		const speedBonus = ship.stats.speed * (viewSize.y * 0.004);
		return baseSpeed + speedBonus;
	}

	//==============================================================================
	// 우주선을 맵 경계 안으로 제한.
	//==============================================================================
	/**
	 * @param { object } ship
	 * @param { object } arena
	 */
	clampShipToMap(ship, arena) {
		const shipHalf = arena.shipHalf;
		const minX = arena.mapLeft + shipHalf;
		const maxX = arena.mapRight - shipHalf;
		const minY = arena.mapTop + shipHalf;
		const maxY = arena.mapBottom - shipHalf;
		if (ship.x < minX) {
			ship.x = minX;
		}
		if (ship.x > maxX) {
			ship.x = maxX;
		}
		if (ship.y < minY) {
			ship.y = minY;
		}
		if (ship.y > maxY) {
			ship.y = maxY;
		}
	}

	//==============================================================================
	// 전투 갱신.
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 * @param { Vector2 } viewSize
	 */
	updateBattle(timeDelta, viewSize) {
		const battleState = this.getBattleState();
		if (battleState.phase !== BATTLE_PHASE_FIGHTING) {
			return;
		}

		battleState.elapsed += timeDelta;
		const arena = this.getBattleArena(viewSize);
		const player = battleState.player;
		const enemy = battleState.enemy;

		// 접근/교전 페이즈 판정. (player 아래, enemy 위)
		const engageGap = viewSize.y * 0.16;
		const verticalGap = player.y - enemy.y;

		if (verticalGap > engageGap) {
			// 접근 페이즈: 서로 이동해 다가간다.
			const playerMoveSpeed = this.getShipMoveSpeed(player, viewSize);
			const enemyMoveSpeed = this.getShipMoveSpeed(enemy, viewSize);
			player.x = arena.centerX;
			enemy.x = arena.centerX;
			player.y -= playerMoveSpeed * timeDelta;
			enemy.y += enemyMoveSpeed * timeDelta;
		}
		else {
			// 교전 페이즈: 좌우로 기동하며 무기를 발사한다.
			player.x = arena.centerX + arena.amplitude * System.Math.sin((battleState.elapsed + player.phaseOffset) * SHIP_MOVE_FREQUENCY);
			enemy.x = arena.centerX + arena.amplitude * System.Math.sin((battleState.elapsed + enemy.phaseOffset) * SHIP_MOVE_FREQUENCY);

			const beamSpeed = viewSize.y * BEAM_SPEED_RATIO;
			this.updateShipFire(player, timeDelta, beamSpeed);
			this.updateShipFire(enemy, timeDelta, beamSpeed);
		}

		// 맵 경계 제한.
		this.clampShipToMap(player, arena);
		this.clampShipToMap(enemy, arena);

		// 빔 이동 및 충돌.
		const beams = battleState.beams;
		const remainingBeams = [];
		const shipHalf = arena.shipHalf;
		for (const beam of beams) {
			beam.y += beam.velocityY * timeDelta;
			if (beam.y < arena.mapTop || beam.y > arena.mapBottom) {
				continue;
			}

			let target = player;
			if (beam.fromPlayer) {
				target = enemy;
			}
			const isHit = beam.x >= target.x - shipHalf &&
				beam.x <= target.x + shipHalf &&
				beam.y >= target.y - shipHalf &&
				beam.y <= target.y + shipHalf;
			if (isHit) {
				target.health -= beam.damage;
				continue;
			}
			remainingBeams.push(beam);
		}
		battleState.beams = remainingBeams;

		// 승패 판정.
		if (player.health <= 0 || enemy.health <= 0) {
			battleState.phase = BATTLE_PHASE_FINISHED;
			let winnerIsPlayer = false;
			if (enemy.health <= 0 && player.health > 0) {
				winnerIsPlayer = true;
			}
			battleState.winnerIsPlayer = winnerIsPlayer;
		}
	}

	//==============================================================================
	// 우주선 무기 발사 갱신.
	//==============================================================================
	/**
	 * @param { object } ship
	 * @param { number } timeDelta
	 * @param { number } beamSpeed
	 */
	updateShipFire(ship, timeDelta, beamSpeed) {
		const attack = ship.stats.attack;
		if (attack <= 0) {
			return;
		}

		ship.fireTimer -= timeDelta;
		if (ship.fireTimer > 0) {
			return;
		}
		ship.fireTimer = FIRE_PERIOD;

		let velocityY = beamSpeed;
		if (ship.isPlayer) {
			velocityY = -beamSpeed;
		}

		const battleState = this.getBattleState();
		battleState.beams.push({
			x: ship.x,
			y: ship.y,
			velocityY: velocityY,
			damage: attack,
			fromPlayer: ship.isPlayer,
		});
	}

	//==============================================================================
	// 전투 화면 입력 처리.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 * @param { Vector2 } viewSize
	 */
	handleBattleInput(viewInputPosition, viewSize) {
		const battleState = this.getBattleState();
		const controlLayout = this.getBattleControlLayout(viewSize);

		if (battleState.phase === BATTLE_PHASE_FINISHED) {
			const confirmButton = controlLayout.confirmButton;
			const isInsideConfirm = viewInputPosition.x >= confirmButton.x &&
				viewInputPosition.x <= confirmButton.x + confirmButton.width &&
				viewInputPosition.y >= confirmButton.y &&
				viewInputPosition.y <= confirmButton.y + confirmButton.height;
			if (isInsideConfirm) {
				this.#battleState = null;
			}
			return;
		}

		const exitButton = controlLayout.exitButton;
		const isInsideExit = viewInputPosition.x >= exitButton.x &&
			viewInputPosition.x <= exitButton.x + exitButton.width &&
			viewInputPosition.y >= exitButton.y &&
			viewInputPosition.y <= exitButton.y + exitButton.height;
		if (isInsideExit) {
			this.#battleState = null;
		}
	}

	//==============================================================================
	// 전투 화면 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { Vector2 } viewSize
	 */
	drawBattle(canvasRenderingContext, viewSize) {
		const battleState = this.getBattleState();
		const arena = this.getBattleArena(viewSize);

		// 전체 배경.
		canvasRenderingContext.fillStyle = "#05070f";
		canvasRenderingContext.fillRect(0, 0, viewSize.x, viewSize.y);

		// 맵 영역 배경.
		const mapWidth = arena.mapRight - arena.mapLeft;
		const mapHeight = arena.mapBottom - arena.mapTop;
		canvasRenderingContext.fillStyle = "#070b1c";
		canvasRenderingContext.fillRect(arena.mapLeft, arena.mapTop, mapWidth, mapHeight);

		// 맵 내부 클리핑. (우주선/빔/별이 맵을 벗어나 그려지지 않게)
		canvasRenderingContext.save();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.rect(arena.mapLeft, arena.mapTop, mapWidth, mapHeight);
		canvasRenderingContext.clip();

		// 우주 배경 별.
		canvasRenderingContext.fillStyle = "#33406a";
		for (const star of battleState.stars) {
			canvasRenderingContext.fillRect(star.x, star.y, 2, 2);
		}

		// 우주선 출력.
		this.drawBattleShip(canvasRenderingContext, battleState.enemy, arena);
		this.drawBattleShip(canvasRenderingContext, battleState.player, arena);

		// 빔 출력.
		const beams = battleState.beams;
		for (const beam of beams) {
			let beamColor = "#ff8a5a";
			if (beam.fromPlayer) {
				beamColor = "#9fe0ff";
			}
			canvasRenderingContext.fillStyle = beamColor;
			canvasRenderingContext.fillRect(beam.x - BEAM_WIDTH * 0.5, beam.y - BEAM_HEIGHT * 0.5, BEAM_WIDTH, BEAM_HEIGHT);
		}

		canvasRenderingContext.restore();

		// 맵 테두리.
		canvasRenderingContext.strokeStyle = "#2a3a6a";
		canvasRenderingContext.lineWidth = 3;
		canvasRenderingContext.strokeRect(arena.mapLeft, arena.mapTop, mapWidth, mapHeight);

		// 체력바 출력. (맵 밖)
		this.drawHealthBar(canvasRenderingContext, battleState.enemy, viewSize, true);
		this.drawHealthBar(canvasRenderingContext, battleState.player, viewSize, false);

		// 조작/결과 출력.
		const controlLayout = this.getBattleControlLayout(viewSize);
		if (battleState.phase === BATTLE_PHASE_FINISHED) {
			// 결과 오버레이.
			canvasRenderingContext.fillStyle = "rgba(0, 0, 0, 0.6)";
			canvasRenderingContext.fillRect(0, 0, viewSize.x, viewSize.y);

			let resultText = "패배...";
			if (battleState.winnerIsPlayer) {
				resultText = "승리!";
			}
			canvasRenderingContext.fillStyle = "#ffffff";
			canvasRenderingContext.font = "bold 72px sans-serif";
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText(resultText, viewSize.x * 0.5, viewSize.y * 0.42);

			const confirmButton = controlLayout.confirmButton;
			canvasRenderingContext.fillStyle = "#3a6ea5";
			canvasRenderingContext.fillRect(confirmButton.x, confirmButton.y, confirmButton.width, confirmButton.height);
			canvasRenderingContext.fillStyle = "#ffffff";
			canvasRenderingContext.font = "bold 32px sans-serif";
			canvasRenderingContext.fillText("확인", confirmButton.x + confirmButton.width * 0.5, confirmButton.y + confirmButton.height * 0.5);
		}
		else {
			const exitButton = controlLayout.exitButton;
			canvasRenderingContext.fillStyle = "#2a3350";
			canvasRenderingContext.fillRect(exitButton.x, exitButton.y, exitButton.width, exitButton.height);
			canvasRenderingContext.fillStyle = "#ffffff";
			canvasRenderingContext.font = "bold 26px sans-serif";
			canvasRenderingContext.textAlign = "center";
			canvasRenderingContext.textBaseline = "middle";
			canvasRenderingContext.fillText("나가기", exitButton.x + exitButton.width * 0.5, exitButton.y + exitButton.height * 0.5);
		}
	}

	//==============================================================================
	// 전투 화면 우주선 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { object } ship
	 * @param { object } arena
	 */
	drawBattleShip(canvasRenderingContext, ship, arena) {
		const cellSize = arena.cellSize;
		const shipHalf = arena.shipHalf;
		const originX = ship.x - shipHalf;
		const originY = ship.y - shipHalf;
		const grid = ship.grid;

		for (let column = 0; column < GRID_COLUMNS; ++column) {
			for (let row = 0; row < GRID_ROWS; ++row) {
				const partIndex = grid[column][row];
				if (partIndex === EMPTY_CELL) {
					continue;
				}
				const cellX = originX + column * cellSize;
				const cellY = originY + row * cellSize;
				this.drawPart(canvasRenderingContext, partIndex, cellX, cellY, cellSize);
			}
		}
	}

	//==============================================================================
	// 전투 화면 체력바 출력.
	//==============================================================================
	/**
	 * @param { CanvasRenderingContext2D } canvasRenderingContext
	 * @param { object } ship
	 * @param { Vector2 } viewSize
	 * @param { boolean } isTop
	 */
	drawHealthBar(canvasRenderingContext, ship, viewSize, isTop) {
		const barWidth = viewSize.x * 0.6;
		const barHeight = System.Math.floor(viewSize.y * 0.012);
		const barX = (viewSize.x - barWidth) * 0.5;
		let barY = viewSize.y * 0.86;
		if (isTop) {
			barY = viewSize.y * 0.07;
		}

		// 배경.
		canvasRenderingContext.fillStyle = "#33384a";
		canvasRenderingContext.fillRect(barX, barY, barWidth, barHeight);

		// 체력.
		let healthRatio = ship.health / ship.maxHealth;
		if (healthRatio < 0) {
			healthRatio = 0;
		}
		let healthColor = "#6ad080";
		if (isTop) {
			healthColor = "#ff6a6a";
		}
		canvasRenderingContext.fillStyle = healthColor;
		canvasRenderingContext.fillRect(barX, barY, barWidth * healthRatio, barHeight);

		// 라벨.
		const displayHealth = System.Math.max(0, System.Math.floor(ship.health));
		const labelText = `${ship.name}  체력 ${displayHealth}`;
		canvasRenderingContext.fillStyle = "#ffffff";
		canvasRenderingContext.font = "24px sans-serif";
		canvasRenderingContext.textAlign = "center";
		canvasRenderingContext.textBaseline = "alphabetic";
		canvasRenderingContext.fillText(labelText, viewSize.x * 0.5, barY - 8);
	}
}


//==============================================================================
// 엔진 기동.
//==============================================================================
const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(1080, 1920);
engineConfiguration.useStatistics = false;
const engine = new Engine(engineConfiguration);
document.title = "playablegames-template";
const scene = new AppScene();
engine.run(scene);
